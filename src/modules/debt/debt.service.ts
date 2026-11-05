import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { UserEntity } from "../user/user.entity";
import { OperationEntity } from "../operation/operation.entity";
import { CategoryType } from "../category/category-type.enum";
import { DebtEntryEntity } from "./debt-entry.entity";
import { DebtKind } from "./debt-kind.enum";
import { DEBT_PLUS_KINDS, normalizePerson, personRef, validatePerson } from "./debt.util";
import type { PersonError } from "./debt.util";

export interface PersonBalance {
  person: string;
  personKey: string;
  /** Positive: the person owes me. Negative: I owe the person. */
  balance: number;
}

export type AddEntryResult =
  | { added: true; entry: DebtEntryEntity }
  | { added: false; reason: PersonError | "invalid_amount" };

export type SplitResult =
  | { split: true; amount: number }
  | {
      split: false;
      reason: PersonError | "invalid_amount" | "not_found" | "too_much";
    };

const PLUS_KINDS_SQL = DEBT_PLUS_KINDS.map((kind) => `'${kind}'`).join(", ");
const SIGNED_AMOUNT_SQL = `CASE WHEN entry.kind IN (${PLUS_KINDS_SQL}) THEN entry.amount ELSE -entry.amount END`;

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const isValidAmount = (value: number) => Number.isFinite(value) && value > 0 && value < 1e10;

@Injectable()
export class DebtService {
  constructor(
    @InjectRepository(DebtEntryEntity)
    private readonly entryRepository: Repository<DebtEntryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async addEntry(
    user: UserEntity,
    input: { person: string; kind: DebtKind; amount: number; comment?: string | null },
  ): Promise<AddEntryResult> {
    const personError = validatePerson(input.person);
    if (personError) {
      return { added: false, reason: personError };
    }
    if (!isValidAmount(input.amount)) {
      return { added: false, reason: "invalid_amount" };
    }

    const entry = await this.entryRepository.save(
      this.entryRepository.create({
        user,
        ...normalizePerson(input.person),
        kind: input.kind,
        amount: roundMoney(input.amount),
        comment: input.comment ?? null,
      }),
    );
    return { added: true, entry };
  }

  /** Non-zero balances, the biggest first. */
  async getBalances(user: UserEntity): Promise<PersonBalance[]> {
    const rows = await this.entryRepository
      .createQueryBuilder("entry")
      .select("entry.personKey", "personKey")
      .addSelect(`(array_agg(entry.person ORDER BY entry.createdAt DESC))[1]`, "person")
      .addSelect(`SUM(${SIGNED_AMOUNT_SQL})`, "balance")
      .where("entry.userId = :userId", { userId: user.id })
      .groupBy("entry.personKey")
      .having(`SUM(${SIGNED_AMOUNT_SQL}) <> 0`)
      .getRawMany<{ personKey: string; person: string; balance: string }>();

    return rows
      .map((row) => ({
        person: row.person,
        personKey: row.personKey,
        balance: roundMoney(parseFloat(row.balance)),
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }

  async findBalanceByRef(user: UserEntity, ref: string): Promise<PersonBalance | null> {
    const balances = await this.getBalances(user);
    return balances.find((item) => personRef(item.personKey) === ref) ?? null;
  }

  /** 0 when the person has no entries or is settled. */
  async getBalance(user: UserEntity, personKey: string): Promise<number> {
    const balances = await this.getBalances(user);
    return balances.find((item) => item.personKey === personKey)?.balance ?? 0;
  }

  /** Newest entries of one person (even when the balance is already zero). */
  getHistory(user: UserEntity, personKey: string, limit = 10): Promise<DebtEntryEntity[]> {
    return this.entryRepository.find({
      where: { user: { id: user.id }, personKey },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  /** People the user dealt with lately, newest first. */
  async getRecentPeople(
    user: UserEntity,
    limit = 6,
  ): Promise<{ person: string; personKey: string }[]> {
    const rows = await this.entryRepository
      .createQueryBuilder("entry")
      .select("entry.personKey", "personKey")
      .addSelect(`(array_agg(entry.person ORDER BY entry.createdAt DESC))[1]`, "person")
      .where("entry.userId = :userId", { userId: user.id })
      .groupBy("entry.personKey")
      .orderBy("MAX(entry.createdAt)", "DESC")
      .limit(limit)
      .getRawMany<{ personKey: string; person: string }>();
    return rows;
  }

  /**
   * Moves `shared` out of an expense into a debt of `person`: `operation.amount` shrinks towards
   * the user's own share and `sharedAmount` accumulates what was paid for others. May be called
   * repeatedly for several people. One transaction; the conditional UPDATE never lets the own
   * share reach zero or go negative. Protection from a double tap lives in the dialog state.
   */
  async splitOperation(
    user: UserEntity,
    operationId: string,
    shared: number,
    person: string,
  ): Promise<SplitResult> {
    const personError = validatePerson(person);
    if (personError) {
      return { split: false, reason: personError };
    }
    if (!isValidAmount(shared)) {
      return { split: false, reason: "invalid_amount" };
    }
    const amount = roundMoney(shared);

    return this.dataSource.transaction(async (manager) => {
      const updated = await manager
        .createQueryBuilder()
        .update(OperationEntity)
        .set({
          amount: () => '"amount" - :shared',
          sharedAmount: () => 'COALESCE("sharedAmount", 0) + :shared',
        })
        .where('"id" = :id AND "userId" = :userId AND "type" = :type AND "amount" > :shared', {
          id: operationId,
          userId: user.id,
          type: CategoryType.EXPENSE,
        })
        .setParameter("shared", amount)
        .execute();

      if (!updated.affected) {
        const operation = await manager.findOne(OperationEntity, {
          where: { id: operationId, user: { id: user.id } },
        });
        if (!operation || operation.type !== CategoryType.EXPENSE) {
          return { split: false, reason: "not_found" } as const;
        }
        return { split: false, reason: "too_much" } as const;
      }

      await manager.getRepository(DebtEntryEntity).save(
        manager.getRepository(DebtEntryEntity).create({
          user,
          ...normalizePerson(person),
          kind: DebtKind.SPLIT,
          amount,
          operation: { id: operationId } as OperationEntity,
        }),
      );
      return { split: true, amount } as const;
    });
  }

  /** Debt entries created by splitting the operation, oldest first. */
  getOperationSplits(user: UserEntity, operationId: string): Promise<DebtEntryEntity[]> {
    return this.entryRepository.find({
      where: { user: { id: user.id }, operation: { id: operationId } },
      order: { createdAt: "ASC" },
    });
  }

  /**
   * Undoes `splitOperation` for all people: the shared amount returns to the expense and the
   * SPLIT entries are deleted. Repayments recorded separately are not touched.
   */
  async cancelSplit(
    user: UserEntity,
    operationId: string,
  ): Promise<{ cancelled: boolean; restored: number }> {
    return this.dataSource.transaction(async (manager) => {
      const operation = await manager.findOne(OperationEntity, {
        where: { id: operationId, user: { id: user.id } },
      });
      const entries = await manager.find(DebtEntryEntity, {
        where: { user: { id: user.id }, operation: { id: operationId } },
      });
      if (!operation || entries.length === 0) {
        return { cancelled: false, restored: 0 };
      }

      const restored = roundMoney(entries.reduce((sum, entry) => sum + entry.amount, 0));
      await manager.update(OperationEntity, operationId, {
        amount: roundMoney(operation.amount + restored),
        sharedAmount: null,
      });
      await manager.remove(entries);
      return { cancelled: true, restored };
    });
  }

  /** Deletes the operation together with the debt entries its split created. */
  async deleteOperation(
    user: UserEntity,
    operationId: string,
  ): Promise<{ deleted: boolean; removedEntries: number }> {
    return this.dataSource.transaction(async (manager) => {
      const operation = await manager.findOne(OperationEntity, {
        where: { id: operationId, user: { id: user.id } },
      });
      if (!operation) {
        return { deleted: false, removedEntries: 0 };
      }

      const entries = await manager.find(DebtEntryEntity, {
        where: { user: { id: user.id }, operation: { id: operationId } },
      });
      await manager.remove(entries);
      await manager.remove(operation);
      return { deleted: true, removedEntries: entries.length };
    });
  }
}

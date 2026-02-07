import { Injectable } from "@nestjs/common";
import { DialogState } from "./dialog-state.types";

@Injectable()
export class DialogStateService {
  private readonly states = new Map<string, DialogState>();

  get(userId: string): DialogState | undefined {
    return this.states.get(userId);
  }

  set(userId: string, state: DialogState): void {
    this.states.set(userId, state);
  }

  update(
    userId: string,
    updater: (current: DialogState) => DialogState,
  ): DialogState | undefined {
    const current = this.states.get(userId);
    if (!current) {
      return undefined;
    }
    const next = updater(current);
    this.states.set(userId, next);
    return next;
  }

  clear(userId: string): void {
    this.states.delete(userId);
  }
}

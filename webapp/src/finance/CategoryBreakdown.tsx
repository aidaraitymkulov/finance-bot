import { useState } from "react";
import type { CategoryTotal } from "../api";
import { formatAmount } from "../format";
import { hapticSelection } from "../telegram";

type Kind = "expense" | "income";

interface Props {
  expense: CategoryTotal[];
  income: CategoryTotal[];
}

/** Categories as a ranked bar list: one hue for every bar (nominal categories, single series). */
export const CategoryBreakdown = ({ expense, income }: Props) => {
  const [kind, setKind] = useState<Kind>("expense");
  const items = (kind === "expense" ? expense : income).filter((item) => item.total > 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);
  const max = items[0]?.total ?? 0;

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">По категориям</h2>
        <div className="segmented segmented--small" role="tablist" aria-label="Тип операций">
          {(["expense", "income"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={kind === value}
              className={
                kind === value ? "segmented__item segmented__item--active" : "segmented__item"
              }
              onClick={() => {
                hapticSelection();
                setKind(value);
              }}
            >
              {value === "expense" ? "Расходы" : "Доходы"}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="empty">{kind === "expense" ? "Расходов нет" : "Доходов нет"}</p>
      ) : (
        <ul className="bars">
          {items.map((item) => (
            <li key={item.category} className="bars__row">
              <div className="bars__text">
                <span className="bars__name">{item.category}</span>
                <span className="bars__value">
                  {formatAmount(item.total)}
                  <span className="bars__share">{Math.round((item.total / total) * 100)}%</span>
                </span>
              </div>
              <div className="bars__track">
                <div className="bars__fill" style={{ width: `${(item.total / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

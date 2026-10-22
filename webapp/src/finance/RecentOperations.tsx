import type { FinanceDashboard } from "../api";
import { formatAmount, formatDay, formatTime } from "../format";

const pad = (value: number) => String(value).padStart(2, "0");

/** ISO timestamp -> "YYYY-MM-DD" in the viewer's time zone. */
const toLocalDateKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const RecentOperations = ({ items }: { items: FinanceDashboard["recent"] }) => (
  <section className="card">
    <div className="card__header">
      <h2 className="card__title">Последние операции</h2>
    </div>
    {items.length === 0 ? (
      <p className="empty">Операций нет</p>
    ) : (
      <ul className="operations">
        {items.map((op) => (
          <li key={op.id} className="operations__row">
            <div className="operations__main">
              <span className="operations__category">{op.category}</span>
              <span className="operations__meta">
                {formatDay(toLocalDateKey(op.createdAt))}, {formatTime(op.createdAt)}
                {op.comment ? ` · ${op.comment}` : ""}
              </span>
            </div>
            <span
              className={
                op.type === "INCOME"
                  ? "operations__amount operations__amount--income"
                  : "operations__amount"
              }
            >
              {op.type === "INCOME" ? "+" : "−"}
              {formatAmount(op.amount)}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

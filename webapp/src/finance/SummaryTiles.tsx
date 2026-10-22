import type { FinanceDashboard } from "../api";
import { formatAmount, pluralizeRu } from "../format";

export const SummaryTiles = ({ summary }: { summary: FinanceDashboard["summary"] }) => {
  const balanceClass =
    summary.balance > 0
      ? "tile__value--positive"
      : summary.balance < 0
        ? "tile__value--negative"
        : "";

  return (
    <section className="card summary">
      <div className="summary__hero">
        <span className="tile__label">Расходы</span>
        <span className="summary__hero-value">{formatAmount(summary.expense)}</span>
        {summary.days > 1 && (
          <span className="tile__hint">
            ≈ {formatAmount(Math.round(summary.avgExpensePerDay))} в день · {summary.days}{" "}
            {pluralizeRu(summary.days, ["день", "дня", "дней"])}
          </span>
        )}
      </div>
      <div className="summary__row">
        <div className="tile">
          <span className="tile__label">Доходы</span>
          <span className="tile__value tile__value--positive">{formatAmount(summary.income)}</span>
        </div>
        <div className="tile">
          <span className="tile__label">Баланс</span>
          <span className={`tile__value ${balanceClass}`}>
            {summary.balance > 0 ? "+" : ""}
            {formatAmount(summary.balance)}
          </span>
        </div>
      </div>
    </section>
  );
};

import type { DashboardPeriod } from "../api";
import { formatMonth, shiftMonth } from "../format";
import { hapticSelection } from "../telegram";

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "today", label: "Сегодня" },
  { value: "last7", label: "7 дней" },
  { value: "month", label: "Месяц" },
];

interface Props {
  period: DashboardPeriod;
  month: string;
  currentMonth: string;
  onPeriodChange: (period: DashboardPeriod) => void;
  onMonthChange: (month: string) => void;
}

export const PeriodPicker = ({
  period,
  month,
  currentMonth,
  onPeriodChange,
  onMonthChange,
}: Props) => (
  <div className="period-picker">
    <div className="segmented" role="tablist" aria-label="Период">
      {PERIODS.map((item) => (
        <button
          key={item.value}
          role="tab"
          aria-selected={period === item.value}
          className={
            period === item.value ? "segmented__item segmented__item--active" : "segmented__item"
          }
          onClick={() => {
            hapticSelection();
            onPeriodChange(item.value);
          }}
        >
          {item.label}
        </button>
      ))}
    </div>

    {period === "month" && (
      <div className="month-switcher">
        <button
          className="icon-button"
          aria-label="Предыдущий месяц"
          onClick={() => {
            hapticSelection();
            onMonthChange(shiftMonth(month, -1));
          }}
        >
          ‹
        </button>
        <span className="month-switcher__label">{formatMonth(month)}</span>
        <button
          className="icon-button"
          aria-label="Следующий месяц"
          disabled={month >= currentMonth}
          onClick={() => {
            hapticSelection();
            onMonthChange(shiftMonth(month, 1));
          }}
        >
          ›
        </button>
      </div>
    )}
  </div>
);

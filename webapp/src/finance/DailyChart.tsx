import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinanceDashboard } from "../api";
import { formatAmount, formatCompact, formatDay, parseLocalDate } from "../format";
import type { ColorScheme } from "../useColorScheme";
import { CHART_COLORS } from "./chartColors";

interface Props {
  daily: FinanceDashboard["daily"];
  scheme: ColorScheme;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: { date: string; expense: number } }[];
}

const DayTooltip = ({ active, payload }: TooltipProps) => {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) {
    return null;
  }
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{formatDay(point.date)}</span>
      <span className="chart-tooltip__value">{formatAmount(point.expense)}</span>
    </div>
  );
};

/** Expenses per day. Income is left out: one salary day would flatten every expense bar. */
export const DailyChart = ({ daily, scheme }: Props) => {
  const colors = CHART_COLORS[scheme];
  const hasExpenses = daily.some((day) => day.expense > 0);

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Расходы по дням</h2>
      </div>
      {!hasExpenses ? (
        <p className="empty">Расходов нет</p>
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={daily}
              margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
              barCategoryGap={2}
            >
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis
                dataKey="date"
                tickFormatter={(date: string) => String(parseLocalDate(date).getDate())}
                tick={{ fill: colors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: colors.grid }}
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis
                tickFormatter={(value: number) => formatCompact(value)}
                tick={{ fill: colors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                content={<DayTooltip />}
                cursor={{ fill: colors.grid, opacity: 0.5 }}
                isAnimationActive={false}
              />
              <Bar
                dataKey="expense"
                fill={colors.series}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

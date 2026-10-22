import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError, DashboardPeriod, fetchFinanceDashboard } from "../api";
import { toMonthKey } from "../format";
import type { ColorScheme } from "../useColorScheme";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { DailyChart } from "./DailyChart";
import { PeriodPicker } from "./PeriodPicker";
import { RecentOperations } from "./RecentOperations";
import { SummaryTiles } from "./SummaryTiles";

const errorText = (error: unknown) => {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return "Нет доступа. Откройте дашборд из бота кнопкой «📊 Дашборд».";
  }
  return "Не удалось загрузить данные. Попробуйте ещё раз.";
};

export const FinanceScreen = ({ scheme }: { scheme: ColorScheme }) => {
  const currentMonth = toMonthKey(new Date());
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [month, setMonth] = useState(currentMonth);

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["finance-dashboard", period, period === "month" ? month : null],
    queryFn: () => fetchFinanceDashboard(period, period === "month" ? month : null),
    placeholderData: keepPreviousData,
  });

  return (
    <main className="screen">
      <header className="screen__header">
        <h1 className="screen__title">Финансы</h1>
        {isFetching && !isPending && <span className="spinner" aria-label="Обновление" />}
      </header>

      <PeriodPicker
        period={period}
        month={month}
        currentMonth={currentMonth}
        onPeriodChange={setPeriod}
        onMonthChange={setMonth}
      />

      {isPending ? (
        <div className="skeleton-stack" aria-busy="true">
          <div className="card skeleton" style={{ height: 150 }} />
          <div className="card skeleton" style={{ height: 220 }} />
          <div className="card skeleton" style={{ height: 260 }} />
        </div>
      ) : error && !data ? (
        <section className="card error">
          <p>{errorText(error)}</p>
          <button className="button" onClick={() => void refetch()}>
            Повторить
          </button>
        </section>
      ) : data ? (
        <div className={isFetching ? "content content--stale" : "content"}>
          <SummaryTiles summary={data.summary} />
          {data.daily.length > 1 && <DailyChart daily={data.daily} scheme={scheme} />}
          <CategoryBreakdown expense={data.expenseByCategory} income={data.incomeByCategory} />
          <RecentOperations items={data.recent} />
        </div>
      ) : null}
    </main>
  );
};

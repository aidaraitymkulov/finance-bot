import { getInitData } from "./telegram";

export type DashboardPeriod = "today" | "last7" | "month";
export type OperationType = "INCOME" | "EXPENSE";

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface FinanceDashboard {
  period: DashboardPeriod;
  month: string | null;
  from: string;
  to: string;
  summary: {
    income: number;
    expense: number;
    balance: number;
    avgIncomePerDay: number;
    avgExpensePerDay: number;
    days: number;
  };
  expenseByCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  daily: { date: string; income: number; expense: number }[];
  recent: {
    id: string;
    createdAt: string;
    type: OperationType;
    category: string;
    amount: number;
    comment: string | null;
  }[];
}

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`API error ${status}`);
  }
}

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, { headers: { Authorization: `tma ${await getInitData()}` } });
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return (await response.json()) as T;
};

export const fetchFinanceDashboard = (period: DashboardPeriod, month: string | null) => {
  const params = new URLSearchParams({ period });
  if (period === "month" && month) {
    params.set("month", month);
  }
  return request<FinanceDashboard>(`/api/finance/dashboard?${params}`);
};

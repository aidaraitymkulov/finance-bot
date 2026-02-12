import { Injectable } from "@nestjs/common";
import * as ExcelJS from "exceljs";
import { CategoryType } from "../category/category-type.enum";
import { OperationForExport, SummaryReport } from "./report.service";

interface CategorySummary {
  category: string;
  total: number;
}

@Injectable()
export class ExcelService {
  async generateReport(
    operations: OperationForExport[],
    summary: SummaryReport,
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const expenses = operations.filter((op) => op.type === CategoryType.EXPENSE);
    const incomes = operations.filter((op) => op.type === CategoryType.INCOME);

    this.createExpenseSheet(workbook, expenses);
    this.createIncomeSheet(workbook, incomes);
    this.createSummarySheet(workbook, summary, expenses, incomes, startDate, endDate);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private createExpenseSheet(
    workbook: ExcelJS.Workbook,
    expenses: OperationForExport[],
  ) {
    const sheet = workbook.addWorksheet("Расходы");

    sheet.columns = [
      { header: "Дата", key: "date", width: 20 },
      { header: "Категория", key: "category", width: 25 },
      { header: "Сумма", key: "amount", width: 15 },
      { header: "Комментарий", key: "comment", width: 40 },
    ];

    this.styleHeader(sheet);

    expenses.forEach((expense) => {
      sheet.addRow({
        date: this.formatDateTime(expense.date),
        category: expense.category,
        amount: expense.amount,
        comment: expense.comment || "",
      });
    });

    this.addTotal(sheet, expenses, 3);
  }

  private createIncomeSheet(
    workbook: ExcelJS.Workbook,
    incomes: OperationForExport[],
  ) {
    const sheet = workbook.addWorksheet("Доходы");

    sheet.columns = [
      { header: "Дата", key: "date", width: 20 },
      { header: "Категория", key: "category", width: 25 },
      { header: "Сумма", key: "amount", width: 15 },
      { header: "Комментарий", key: "comment", width: 40 },
    ];

    this.styleHeader(sheet);

    incomes.forEach((income) => {
      sheet.addRow({
        date: this.formatDateTime(income.date),
        category: income.category,
        amount: income.amount,
        comment: income.comment || "",
      });
    });

    this.addTotal(sheet, incomes, 3);
  }

  private createSummarySheet(
    workbook: ExcelJS.Workbook,
    summary: SummaryReport,
    expenses: OperationForExport[],
    incomes: OperationForExport[],
    startDate: Date,
    endDate: Date,
  ) {
    const sheet = workbook.addWorksheet("Сводка");

    const expensesByCategory = this.groupByCategory(expenses);
    const incomesByCategory = this.groupByCategory(incomes);

    sheet.addRow(["Отчёт за период"]).font = { bold: true, size: 14 };
    sheet.addRow([`${this.formatDate(startDate)} — ${this.formatDate(endDate)}`]);
    sheet.addRow([]);

    sheet.addRow(["Общая сводка"]).font = { bold: true };
    sheet.addRow(["Доход:", summary.income.toFixed(2)]);
    sheet.addRow(["Расход:", summary.expense.toFixed(2)]);
    sheet.addRow(["Баланс:", summary.balance.toFixed(2)]);
    sheet.addRow([]);

    if (expensesByCategory.length > 0) {
      sheet.addRow(["Расходы по категориям"]).font = { bold: true };
      const expenseHeader = sheet.addRow(["Категория", "Сумма"]);
      expenseHeader.font = { bold: true };
      expenseHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      expensesByCategory.forEach((item) => {
        sheet.addRow([item.category, item.total.toFixed(2)]);
      });

      sheet.addRow([]);
    }

    if (incomesByCategory.length > 0) {
      sheet.addRow(["Доходы по категориям"]).font = { bold: true };
      const incomeHeader = sheet.addRow(["Категория", "Сумма"]);
      incomeHeader.font = { bold: true };
      incomeHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      incomesByCategory.forEach((item) => {
        sheet.addRow([item.category, item.total.toFixed(2)]);
      });
    }

    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 15;
  }

  private styleHeader(sheet: ExcelJS.Worksheet) {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  private addTotal(sheet: ExcelJS.Worksheet, operations: OperationForExport[], amountColumn: number) {
    if (operations.length === 0) {
      return;
    }

    const total = operations.reduce((sum, op) => sum + op.amount, 0);
    const totalRow = sheet.addRow([]);
    totalRow.getCell(amountColumn - 1).value = "Итого:";
    totalRow.getCell(amountColumn - 1).font = { bold: true };
    totalRow.getCell(amountColumn).value = total.toFixed(2);
    totalRow.getCell(amountColumn).font = { bold: true };
  }

  private groupByCategory(operations: OperationForExport[]): CategorySummary[] {
    const map = new Map<string, number>();

    operations.forEach((op) => {
      const current = map.get(op.category) || 0;
      map.set(op.category, current + op.amount);
    });

    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private formatDateTime(date: Date): string {
    const base = this.formatDate(date);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${base} ${hours}:${minutes}`;
  }
}

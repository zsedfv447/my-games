// 主城自動跳出上週的契約週報：每週一次，跳出時就記下（progression/weekly-report.ts）
import { markWeeklyReportShown, weeklyReportToShow } from '../progression/weekly-report';
import { openWeeklyReport } from './components/weekly-report';
import { commit, getSave, growth } from './state';

export function maybeShowWeeklyReport(now = Date.now()): boolean {
  const report = weeklyReportToShow(getSave(), now, (id) => growth.card(id));
  if (!report) return false;
  commit(markWeeklyReportShown(getSave(), report.week));
  openWeeklyReport(report);
  return true;
}

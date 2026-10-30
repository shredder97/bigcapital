import {
  financialReportMenuData,
  type FinancialReportText,
} from './financialReportsMenu.data';
import type { FinancialSection } from '@/containers/FinancialStatements/FilterFinancialReports';
import { FormattedMessage as T } from '@/components';

function reportLabel(label: FinancialReportText) {
  if ('messageId' in label) {
    return <T id={label.messageId} />;
  }
  return label.text;
}

export const financialReportMenus: FinancialSection[] =
  financialReportMenuData.map((section) => ({
    sectionTitle: reportLabel(section.sectionTitle),
    reports: section.reports.map((report) => ({
      title: reportLabel(report.title),
      desc: reportLabel(report.desc),
      link: report.link,
      subject: report.subject,
      ability: report.ability,
      ...(report.feature ? { feature: report.feature } : {}),
    })),
  }));

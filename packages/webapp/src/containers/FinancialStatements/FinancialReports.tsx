import { useFilterFinancialReports } from './FilterFinancialReports';
import { DashboardInsider } from '@/components';
import { financialReportMenus } from '@/constants/financialReportsMenu';
import { ShortcutBoxes } from '@/containers/Homepage/ShortcutBoxesSection';

import '@/style/pages/HomePage/HomePage.scss';

export function FinancialReports() {
  const financialReportMenu = useFilterFinancialReports(financialReportMenus);

  return (
    <DashboardInsider name={'financial-reports'}>
      <div className="homepage-shortcuts">
        {financialReportMenu.map(({ sectionTitle, reports }, index) => (
          <ShortcutBoxes
            key={index}
            sectionTitle={sectionTitle}
            shortcuts={reports.map(({ title, desc, link }) => ({
              title,
              link,
              description: <>{desc}</>,
            }))}
          />
        ))}
      </div>
    </DashboardInsider>
  );
}

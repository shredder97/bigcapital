import React from 'react';
import { FormattedMessage as T } from '@/components';
import { BrandMark } from '@/components/BrandMark';

export default function DashboardErrorBoundary() {
  return (
    <div className="dashboard__error-boundary">
      <h1>
        <T id={'sorry_about_that_something_went_wrong'} />
      </h1>
      <p>
        <T id={'if_the_problem_stuck_please_contact_us_as_soon_as_possible'} />
      </p>
      <BrandMark className="brand-mark--sm" />
    </div>
  );
}

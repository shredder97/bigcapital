import classNames from 'classnames';
import { BrandMark } from '@/components/BrandMark';

import '@/style/components/BigcapitalLoading.scss';

interface BigcapitalLoadingProps {
  className?: string;
}

export default function BigcapitalLoading({
  className,
}: BigcapitalLoadingProps) {
  return (
    <div className={classNames('bigcapital-loading', className)}>
      <div className="center">
        <BrandMark />
      </div>
    </div>
  );
}

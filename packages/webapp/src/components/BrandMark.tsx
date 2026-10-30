import classNames from 'classnames';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={classNames('brand-mark', className)} aria-label="Evena">
      E
    </span>
  );
}

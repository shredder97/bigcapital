import { Icon, Tooltip } from '@blueprintjs/core';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useFilterShortcutBoxesSection } from './components';
import type {
  HomepageSectionOption,
  HomepageShortcutOption,
} from '@/constants/types';
import { For } from '@/components';

export function ShortcutPill({
  title,
  link,
  description,
  icon,
}: HomepageShortcutOption) {
  const tooltipId = useId();

  return (
    <Tooltip
      boundary="viewport"
      content={description}
      hoverOpenDelay={300}
      openOnTargetFocus
      popoverClassName="homepage-shortcut-tooltip"
    >
      <Link aria-describedby={tooltipId} className="homepage-pill" to={link}>
        {icon && <Icon icon={icon} iconSize={15} />}
        <span className="homepage-pill__label">{title}</span>
        <span className="homepage-pill__description" id={tooltipId}>
          {description}
        </span>
      </Link>
    </Tooltip>
  );
}

interface ShortcutBoxesProps {
  sectionTitle: React.ReactNode;
  shortcuts: HomepageShortcutOption[];
}

export function ShortcutBoxes({ sectionTitle, shortcuts }: ShortcutBoxesProps) {
  return (
    <section className="homepage-shortcuts__section">
      <h2 className="homepage-shortcuts__title">{sectionTitle}</h2>
      <div className="homepage-shortcuts__list">
        {shortcuts.map((shortcut) => (
          <ShortcutPill key={shortcut.link} {...shortcut} />
        ))}
      </div>
    </section>
  );
}

interface ShortcutBoxesSectionProps {
  section: HomepageSectionOption[];
}

export function ShortcutBoxesSection({ section }: ShortcutBoxesSectionProps) {
  const BoxSection = useFilterShortcutBoxesSection(section);
  return <For render={ShortcutBoxes} of={BoxSection} />;
}

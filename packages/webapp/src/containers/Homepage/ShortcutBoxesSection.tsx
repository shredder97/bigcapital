import {
  Icon,
  PopoverInteractionKind,
  Position,
  Tooltip,
} from '@blueprintjs/core';
import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFilterShortcutBoxesSection } from './components';
import type {
  HomepageSectionOption,
  HomepageShortcutOption,
} from '@/constants/types';
import { For } from '@/components';

const PILL_TINTS = ['sage', 'lavender', 'peach', 'blue', 'sand'] as const;

type BlueprintIconName = React.ComponentProps<typeof Icon>['icon'];

interface ShortcutPillProps extends HomepageShortcutOption {
  index: number;
}

function ShortcutPill({
  title,
  link,
  description,
  icon,
  index,
}: ShortcutPillProps) {
  const tint = PILL_TINTS[index % PILL_TINTS.length];
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <Tooltip
      boundary="viewport"
      content={<span id={tooltipId}>{description}</span>}
      hoverOpenDelay={300}
      interactionKind={PopoverInteractionKind.HOVER_TARGET_ONLY}
      isOpen={open}
      onInteraction={setOpen}
      openOnTargetFocus
      popoverClassName="homepage-shortcut-tooltip"
      position={Position.TOP}
      usePortal
    >
      <Link
        aria-describedby={open ? tooltipId : undefined}
        className={`homepage-pill homepage-pill--${tint}`}
        to={link}
      >
        <Icon icon={icon as BlueprintIconName} iconSize={15} />
        <span className="homepage-pill__label">{title}</span>
      </Link>
    </Tooltip>
  );
}

interface ShortcutBoxesProps {
  sectionTitle: React.ReactNode;
  shortcuts: HomepageShortcutOption[];
}

function ShortcutBoxes({ sectionTitle, shortcuts }: ShortcutBoxesProps) {
  return (
    <section className="homepage-shortcuts__section">
      <h2 className="homepage-shortcuts__title">{sectionTitle}</h2>
      <div className="homepage-shortcuts__list">
        {shortcuts.map((shortcut, index) => (
          <ShortcutPill index={index} key={shortcut.link} {...shortcut} />
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

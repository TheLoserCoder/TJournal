import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import type { TagDto } from '../../../shared/desktop-api';
import { Popover } from '../../components/ui/popover';
import { Tooltip } from '../../components/ui/tooltip';
import { TagChip } from './tag-chip';

/** Hover delay before a tag comment appears, in milliseconds. */
const TAG_TOOLTIP_DELAY = 500;

interface TagOverflowListProps {
  readonly emptyLabel: string;
  readonly showMoreLabel: (hiddenCount: number) => string;
  readonly tags: readonly TagDto[];
}

/**
 * Shows as many tag chips as the cell width allows and folds the rest behind a
 * `+N` trigger. A hidden measurement row holds every chip, so the decision is a
 * single layout read rather than a per-chip effect.
 */
export const TagOverflowList = ({
  emptyLabel,
  showMoreLabel,
  tags,
}: TagOverflowListProps): ReactElement => {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(tags.length);
  const [open, setOpen] = useState(false);

  const recompute = useCallback((): void => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (container === null || measure === null) return;
    const available = container.clientWidth;
    if (available <= 0) return;
    const gap = Number.parseFloat(getComputedStyle(container).columnGap) || 0;
    const chips = Array.from(measure.querySelectorAll<HTMLElement>('[data-measure-chip]'));
    if (chips.length === 0) {
      setVisibleCount(0);
      return;
    }
    const triggerWidth =
      measure.querySelector<HTMLElement>('[data-measure-trigger]')?.offsetWidth ?? 0;
    const widths = chips.map((chip) => chip.offsetWidth);
    const total = widths.reduce((sum, width, index) => sum + width + (index === 0 ? 0 : gap), 0);
    if (total <= available) {
      setVisibleCount(chips.length);
      return;
    }
    let used = 0;
    let count = 0;
    for (let index = 0; index < widths.length; index += 1) {
      const next = used + (index === 0 ? 0 : gap) + (widths[index] ?? 0);
      if (next + gap + triggerWidth <= available) {
        used = next;
        count = index + 1;
      } else break;
    }
    setVisibleCount(count);
  }, []);

  useLayoutEffect(() => {
    recompute();
  }, [recompute, tags]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recompute]);

  useEffect(() => {
    setOpen(false);
  }, [tags]);

  if (tags.length === 0) {
    return <span className="table-muted">{emptyLabel}</span>;
  }

  const hiddenTags = tags.slice(visibleCount);
  return (
    <span className="tag-overflow" ref={containerRef}>
      <span aria-hidden="true" className="tag-overflow-measure" ref={measureRef}>
        {tags.map((tag) => (
          <span className="tag-overflow-measure-chip" data-measure-chip key={tag.id}>
            <TagChip color={tag.color} label={tag.name} />
          </span>
        ))}
        <span className="tag-chip tag-overflow-trigger" data-measure-trigger>
          +{tags.length}
        </span>
      </span>
      {tags.slice(0, visibleCount).map((tag) => (
        <Tooltip
          content={tag.description === '' ? tag.name : tag.description}
          delayDuration={TAG_TOOLTIP_DELAY}
          key={tag.id}
        >
          <TagChip color={tag.color} label={tag.name} />
        </Tooltip>
      ))}
      {hiddenTags.length > 0 ? (
        <Popover
          onOpenChange={setOpen}
          open={open}
          trigger={
            <button
              aria-label={showMoreLabel(hiddenTags.length)}
              className="tag-overflow-trigger"
              type="button"
            >
              +{hiddenTags.length}
            </button>
          }
        >
          <ul className="tag-overflow-list">
            {hiddenTags.map((tag) => (
              <li key={tag.id}>
                <TagChip color={tag.color} label={tag.name} />
                {tag.description === '' ? null : (
                  <span className="tag-overflow-description">{tag.description}</span>
                )}
              </li>
            ))}
          </ul>
        </Popover>
      ) : null}
    </span>
  );
};

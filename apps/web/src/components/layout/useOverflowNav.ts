import { RefObject, useLayoutEffect, useState } from 'react';

import type { RoleNavItem } from './RoleAppShell';

interface UseOverflowNavResult {
  visibleItems: RoleNavItem[];
  overflowItems: RoleNavItem[];
}

/**
 * Accurately measures the container and its children to determine how many items fit.
 * Requires the consumer to render all items (or a hidden duplicate) to get exact widths.
 */
export function useOverflowNav(
  items: RoleNavItem[],
  containerRef: RefObject<HTMLElement | null>,
  moreButtonWidth = 90
): UseOverflowNavResult {
  const [visibleCount, setVisibleCount] = useState<number>(items.length);

  // We can measure the `offsetLeft` + `offsetWidth` of each child.
  // If `child.offsetLeft + child.offsetWidth > container.clientWidth - moreButtonWidth`, it goes to overflow.

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeObserver: ResizeObserver | null = null;
    let itemWidths: number[] = [];
    const gap = 4; // 4px gap

    const updateVisibility = (containerWidth: number) => {
      let currentWidth = 0;
      let count = 0;

      for (let i = 0; i < itemWidths.length; i++) {
        const itemWidth = itemWidths[i];
        const nextWidth = currentWidth + itemWidth + (i > 0 ? gap : 0);

        // If this is the last item and it fits perfectly without a "More" button
        if (i === itemWidths.length - 1 && nextWidth <= containerWidth) {
          count = itemWidths.length;
          break;
        }

        // If it doesn't fit with the More button, stop
        if (nextWidth + gap + moreButtonWidth > containerWidth) {
          // Edge case: if we can't even fit 1 item + More, just show 1 item anyway
          if (count === 0) count = 1;
          break;
        }

        currentWidth = nextWidth;
        count++;
      }

      setVisibleCount(count);
    };

    resizeObserver = new ResizeObserver((entries) => {
      // First, if we don't have item widths, we need to extract them.
      // We expect the DOM to have all children (some might be hidden, but we need their natural widths).
      // If we use a hidden measurement container, we can just grab its children.
      const measureTrack = container.querySelector('[data-measure-track="true"]');
      if (measureTrack) {
        const children = Array.from(measureTrack.children) as HTMLElement[];
        itemWidths = children.map((c) => c.offsetWidth);
      }

      for (const entry of entries) {
        if (itemWidths.length > 0) {
          updateVisibility(entry.contentRect.width);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver?.disconnect();
    };
  }, [moreButtonWidth, containerRef]);

  return {
    visibleItems: items.slice(0, visibleCount),
    overflowItems: items.slice(visibleCount),
  };
}

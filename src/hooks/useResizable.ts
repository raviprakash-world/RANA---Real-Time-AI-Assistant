"use client";

import { RefObject, useCallback, useRef } from "react";

/** Same imperative-during-drag, commit-on-release pattern as useDraggable. */
export function useResizable(
  containerRef: RefObject<HTMLElement | null>,
  bounds: { minWidth: number; minHeight: number; maxWidth: number; maxHeight: number },
  onResizeEnd: (size: { width: number; height: number }) => void
) {
  const resize = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      resize.current = { startX: e.clientX, startY: e.clientY, startWidth: el.offsetWidth, startHeight: el.offsetHeight };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.stopPropagation();
    },
    [containerRef]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = resize.current;
      const el = containerRef.current;
      if (!state || !el) return;
      const nextWidth = clamp(state.startWidth + (e.clientX - state.startX), bounds.minWidth, bounds.maxWidth);
      const nextHeight = clamp(state.startHeight + (e.clientY - state.startY), bounds.minHeight, bounds.maxHeight);
      el.style.width = `${nextWidth}px`;
      el.style.height = `${nextHeight}px`;
      e.stopPropagation();
    },
    [containerRef, bounds.minWidth, bounds.minHeight, bounds.maxWidth, bounds.maxHeight]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const state = resize.current;
      const el = containerRef.current;
      resize.current = null;
      if (!state || !el) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      onResizeEnd({ width: el.offsetWidth, height: el.offsetHeight });
      e.stopPropagation();
    },
    [containerRef, onResizeEnd]
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

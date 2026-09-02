"use client";

import { RefObject, useCallback, useRef } from "react";

/**
 * Imperative drag: while dragging, the container's left/top are written
 * directly to the DOM (no React state, no re-render) so dragging stays
 * smooth regardless of how much content is inside the panel (section 25 —
 * don't rerender the whole assistant on every interaction). Only the final
 * position is reported back, once, on pointer-up.
 */
export function useDraggable(containerRef: RefObject<HTMLElement | null>, onDragEnd: (pos: { x: number; y: number }) => void) {
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Never start a drag from a button/input inside the handle, or while selecting text.
      if ((e.target as HTMLElement).closest("button, input, select, textarea, a")) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      drag.current = { startX: e.clientX, startY: e.clientY, originX: rect.left, originY: rect.top };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [containerRef]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = drag.current;
      const el = containerRef.current;
      if (!state || !el) return;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const maxX = Math.max(window.innerWidth - width, 0);
      const maxY = Math.max(window.innerHeight - height, 0);
      const nextX = Math.min(Math.max(state.originX + (e.clientX - state.startX), 0), maxX);
      const nextY = Math.min(Math.max(state.originY + (e.clientY - state.startY), 0), maxY);
      el.style.left = `${nextX}px`;
      el.style.top = `${nextY}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
    },
    [containerRef]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const state = drag.current;
      const el = containerRef.current;
      drag.current = null;
      if (!state || !el) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      onDragEnd({ x: Math.round(rect.left), y: Math.round(rect.top) });
    },
    [containerRef, onDragEnd]
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}

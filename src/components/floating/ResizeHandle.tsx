"use client";

export function ResizeHandle({
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      aria-label="Resize assistant panel"
      title="Drag to resize"
      className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
    >
      <svg viewBox="0 0 16 16" className="h-full w-full text-[var(--panel-muted)] opacity-60">
        <path d="M14 2 L2 14 M14 8 L8 14 M14 14 L14 14" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}

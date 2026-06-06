"use client";

import { ArrowRight, Check } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type Props = {
  label?: string;
  onConfirm: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function SlideToConfirm({
  label = "Slide to confirm execute",
  onConfirm,
  disabled,
  loading,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const maxX = useRef(0);

  const reset = useCallback(() => {
    setDragX(0);
    dragging.current = false;
  }, []);

  const onStart = (clientX: number) => {
    if (disabled || loading || confirmed) return;
    const track = trackRef.current;
    if (!track) return;
    dragging.current = true;
    startX.current = clientX;
    maxX.current = track.offsetWidth - 56;
  };

  const onMove = (clientX: number) => {
    if (!dragging.current) return;
    let next = clientX - startX.current;
    if (next < 0) next = 0;
    if (next > maxX.current) next = maxX.current;
    setDragX(next);
  };

  const onEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX > maxX.current * 0.9) {
      setDragX(maxX.current);
      setConfirmed(true);
      onConfirm();
    } else {
      reset();
    }
  };

  const locked = disabled || loading || confirmed;

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-2 text-center text-[13px] text-cops-on-surface-variant">
        Slide to execute approved cleanup across connected systems.
      </p>
      <div
        ref={trackRef}
        className={`relative flex h-14 items-center justify-center overflow-hidden rounded-full border border-cops-outline-variant bg-cops-surface-container-high ${
          confirmed ? "bg-cops-primary-container" : ""
        } ${locked && !confirmed ? "opacity-50" : ""}`}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchMove={(e) => onMove(e.touches[0]?.clientX ?? 0)}
        onTouchEnd={onEnd}
      >
        <span
          className={`pointer-events-none z-0 select-none text-[11px] font-medium uppercase tracking-wider text-cops-on-surface-variant ${
            confirmed ? "text-cops-inverse-on-surface" : ""
          }`}
        >
          {loading ? "Executing…" : confirmed ? "Confirmed" : label}
        </span>
        <div
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-disabled={locked}
          className={`absolute left-1 top-1 z-10 flex h-12 w-12 cursor-grab items-center justify-center rounded-full shadow active:cursor-grabbing ${
            confirmed
              ? "bg-cops-on-primary text-cops-primary-container"
              : "bg-cops-primary text-cops-on-primary"
          }`}
          style={{ transform: `translateX(${dragX}px)`, transition: dragging.current ? "none" : "transform 0.3s ease" }}
          onMouseDown={(e) => onStart(e.clientX)}
          onTouchStart={(e) => onStart(e.touches[0]?.clientX ?? 0)}
        >
          {confirmed || loading ? (
            <Check className="h-5 w-5" aria-hidden />
          ) : (
            <ArrowRight className="h-5 w-5" aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}

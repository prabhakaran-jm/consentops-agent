"use client";

import { ArrowRight, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  label?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  /** Set by parent when execution succeeds — drives the green confirmed state. */
  completed?: boolean;
};

export function SlideToConfirm({
  label = "Slide to confirm execute",
  onConfirm,
  disabled,
  loading,
  completed = false,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const dragXRef = useRef(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const maxX = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const reset = useCallback(() => {
    setDragX(0);
    dragXRef.current = 0;
    dragging.current = false;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!completed && !loading) {
      const id = window.setTimeout(reset, 0);
      return () => window.clearTimeout(id);
    }
  }, [completed, loading, reset]);

  const onStart = (clientX: number) => {
    if (disabled || loading || completed) return;
    const track = trackRef.current;
    if (!track) return;
    dragging.current = true;
    setIsDragging(true);
    startX.current = clientX;
    maxX.current = track.offsetWidth - 56;
  };

  const onMove = (clientX: number) => {
    if (!dragging.current) return;
    let next = clientX - startX.current;
    if (next < 0) next = 0;
    if (next > maxX.current) next = maxX.current;
    dragXRef.current = next;
    setDragX(next);
  };

  const onEnd = async () => {
    if (!dragging.current || completed || loading) return;
    dragging.current = false;
    setIsDragging(false);
    const x = dragXRef.current;
    if (x > maxX.current * 0.9) {
      setDragX(maxX.current);
      dragXRef.current = maxX.current;
      try {
        await onConfirm();
      } catch {
        reset();
      }
    } else {
      reset();
    }
  };

  const locked = disabled || loading || completed;

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-2 text-center text-[13px] text-cops-on-surface-variant">
        Slide to execute approved cleanup across connected systems.
      </p>
      <div
        ref={trackRef}
        className={`relative flex h-14 items-center justify-center overflow-hidden rounded-full border border-cops-secondary/20 bg-cops-surface-container-high ${
          completed ? "border-cops-on-tertiary-container/40 bg-[#E6F4EA]" : ""
        } ${locked && !completed ? "opacity-50" : ""}`}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchMove={(e) => onMove(e.touches[0]?.clientX ?? 0)}
        onTouchEnd={onEnd}
      >
        <span
          className={`pointer-events-none z-0 select-none text-[11px] font-medium uppercase tracking-wider text-cops-on-surface-variant ${
            completed ? "text-cops-inverse-on-surface" : ""
          }`}
        >
          {loading ? "Executing…" : completed ? "Confirmed" : label}
        </span>
        <div
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-disabled={locked}
          className={`absolute left-1 top-1 z-10 flex h-12 w-12 cursor-grab items-center justify-center rounded-full shadow-md active:cursor-grabbing ${
            completed
              ? "bg-cops-on-tertiary-container text-white"
              : "bg-cops-secondary text-cops-on-secondary"
          }`}
          style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}
          onMouseDown={(e) => onStart(e.clientX)}
          onTouchStart={(e) => onStart(e.touches[0]?.clientX ?? 0)}
        >
          {completed || loading ? (
            <Check className="h-5 w-5" aria-hidden />
          ) : (
            <ArrowRight className="h-5 w-5" aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}

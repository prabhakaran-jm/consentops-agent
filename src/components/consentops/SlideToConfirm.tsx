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

const KNOB_SIZE_PX = 48;
const TRACK_INSET_PX = 8;

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
  const confirming = useRef(false);
  const startX = useRef(0);
  const maxX = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const measureMaxX = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    return Math.max(0, track.offsetWidth - KNOB_SIZE_PX - TRACK_INSET_PX);
  }, []);

  const reset = useCallback(() => {
    setDragX(0);
    dragXRef.current = 0;
    dragging.current = false;
    confirming.current = false;
    setIsDragging(false);
  }, []);

  const snapToEnd = useCallback(() => {
    const max = measureMaxX();
    maxX.current = max;
    setDragX(max);
    dragXRef.current = max;
  }, [measureMaxX]);

  useEffect(() => {
    if (completed) return;
    if (loading) return;
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [completed, loading, reset]);

  const onMove = useCallback((clientX: number) => {
    if (!dragging.current) return;
    let next = clientX - startX.current;
    if (next < 0) next = 0;
    if (next > maxX.current) next = maxX.current;
    dragXRef.current = next;
    setDragX(next);
  }, []);

  const onEnd = useCallback(async () => {
    if (!dragging.current || completed || loading || confirming.current) return;
    dragging.current = false;
    setIsDragging(false);

    const x = dragXRef.current;
    const threshold = maxX.current * 0.9;

    if (maxX.current > 0 && x >= threshold) {
      snapToEnd();
      confirming.current = true;
      try {
        await onConfirm();
      } catch {
        reset();
      } finally {
        confirming.current = false;
      }
    } else {
      reset();
    }
  }, [completed, loading, onConfirm, reset, snapToEnd]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || loading || completed || confirming.current) return;
    const track = trackRef.current;
    if (!track) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    maxX.current = measureMaxX();
    dragging.current = true;
    setIsDragging(true);
    startX.current = event.clientX - dragXRef.current;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    onMove(event.clientX);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    void onEnd();
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    reset();
  };

  const locked = disabled || loading || completed;

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-2 text-center text-[13px] text-cops-on-surface-variant">
        Slide to execute approved cleanup across connected systems.
      </p>
      <div
        ref={trackRef}
        className={`relative flex h-14 touch-none items-center justify-center overflow-hidden rounded-full border border-cops-secondary/20 bg-cops-surface-container-high ${
          completed ? "border-cops-on-tertiary-container/40 bg-[#E6F4EA]" : ""
        } ${locked && !completed ? "opacity-50" : ""}`}
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
          aria-label={label}
          className={`absolute top-1 z-10 flex h-12 w-12 cursor-grab touch-none items-center justify-center rounded-full shadow-md select-none active:cursor-grabbing ${
            completed ? "right-1" : "left-1"
          } ${
            completed
              ? "bg-cops-on-tertiary-container text-white"
              : "bg-cops-secondary text-cops-on-secondary"
          }`}
          style={
            completed
              ? undefined
              : { transform: `translateX(${dragX}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          {completed || loading ? (
            <Check className="h-5 w-5" aria-hidden />
          ) : (
            <ArrowRight className="h-5 w-5" aria-hidden />
          )}
        </div>
      </div>
      {disabled && !completed && !loading && (
        <p className="mt-2 text-center text-[12px] text-cops-outline">
          Select at least one action above to enable the slider.
        </p>
      )}
    </div>
  );
}

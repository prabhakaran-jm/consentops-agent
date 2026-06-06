import type { ReactNode } from "react";

export function StepPanel({
  id,
  step,
  title,
  headerRight,
  children,
  className = "",
  dimmed,
  bodyClassName = "p-6",
}: {
  id?: string;
  step: number;
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  dimmed?: boolean;
  bodyClassName?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 overflow-hidden rounded-lg border border-cops-outline-variant bg-cops-surface-container-lowest shadow-sm ${
        dimmed ? "pointer-events-none opacity-50 grayscale" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between border-b border-cops-outline-variant bg-cops-surface-container-low px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded bg-cops-primary px-2 py-1 font-mono text-[10px] font-bold text-cops-on-primary">
            STEP {step}
          </span>
          <h2 className="text-lg font-semibold text-cops-primary">{title}</h2>
        </div>
        {headerRight}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Panel({
  title,
  step,
  children,
  className = "",
}: {
  title: string;
  step?: number;
  children: ReactNode;
  className?: string;
}) {
  if (step !== undefined) {
    return (
      <StepPanel step={step} title={title} className={className}>
        {children}
      </StepPanel>
    );
  }
  return (
    <section
      className={`rounded-lg border border-cops-outline-variant bg-cops-surface-container-lowest p-5 shadow-sm ${className}`}
    >
      <h2 className="text-lg font-semibold text-cops-primary">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline";
}) {
  const styles = {
    primary: "bg-cops-primary text-cops-on-primary hover:opacity-90",
    secondary: "bg-cops-secondary text-cops-on-secondary hover:opacity-90",
    outline:
      "border border-cops-outline-variant bg-cops-surface text-cops-secondary hover:bg-cops-surface-container",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
    >
      {loading ? "Working…" : children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "border border-cops-outline-variant bg-cops-surface text-cops-on-surface-variant",
    success: "border border-[#CEEAD6] bg-[#E6F4EA] text-cops-on-tertiary-container",
    warning: "border border-[#FAD2CF] bg-[#FCE8E6] text-cops-on-error-container",
    danger: "border border-[#FAD2CF] bg-cops-error-container text-cops-on-error-container",
    info: "border border-cops-secondary-container/30 bg-cops-surface-container-high text-cops-on-secondary-container",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function formatIsoTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function formatRelativeTime(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return iso;
  }
}

export function DensityBar({
  value,
  max,
  tone = "secondary",
}: {
  value: number;
  max: number;
  tone?: "secondary" | "error";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bar = tone === "error" ? "bg-cops-error" : "bg-cops-secondary";
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-cops-surface-variant">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

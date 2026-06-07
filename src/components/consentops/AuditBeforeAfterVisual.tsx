import { ArrowRight } from "lucide-react";

type Props = {
  before: number;
  after: number;
};

export function AuditBeforeAfterVisual({ before, after }: Props) {
  const removed = Math.max(0, before - after);
  const unchanged = after === before;

  return (
    <div className="rounded-lg border border-cops-outline-variant bg-cops-surface-container-low p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-cops-outline">
        Live re-scan verification
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase text-cops-on-surface-variant">Before</p>
          <p className="text-4xl font-bold tabular-nums text-cops-primary">{before}</p>
          <p className="text-[11px] text-cops-outline">matches</p>
        </div>
        <ArrowRight className="h-8 w-8 text-cops-secondary" aria-hidden />
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase text-cops-on-surface-variant">After</p>
          <p className="text-4xl font-bold tabular-nums text-cops-on-tertiary-container">{after}</p>
          <p className="text-[11px] text-cops-outline">remaining</p>
        </div>
      </div>
      <p className="mt-4 text-center text-[13px] text-cops-on-surface-variant">
        {unchanged
          ? "Counts unchanged — retain-only or non-destructive actions only."
          : `${removed} match${removed === 1 ? "" : "es"} removed or anonymized in the warehouse (live re-scan).`}
      </p>
    </div>
  );
}

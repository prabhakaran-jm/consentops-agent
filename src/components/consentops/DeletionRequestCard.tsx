import { History, Info, Search, User } from "lucide-react";

import type { ConsentSubject } from "@/lib/warehouse/types";

import { PrimaryButton, StepPanel } from "./ui";

type Props = {
  subject: ConsentSubject;
  onScan: () => void;
  loading: boolean;
  scanned: boolean;
};

export function DeletionRequestCard({ subject, onScan, loading, scanned }: Props) {
  return (
    <StepPanel
      id="step-1"
      step={1}
      title="Deletion Request"
      headerRight={
        <span className="rounded bg-cops-surface-variant px-2 py-1 font-mono text-[11px] text-cops-on-surface-variant">
          ID: REQ-88291-DEL
        </span>
      }
    >
      <div className="flex flex-col items-start gap-6 md:flex-row">
        <div className="w-full flex-1 rounded border border-cops-outline-variant bg-cops-surface p-4">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cops-outline-variant bg-cops-surface-container-highest text-cops-on-surface-variant">
              <User className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h3 className="font-semibold text-cops-primary">{subject.fullName}</h3>
              <p className="font-mono text-xs text-cops-on-surface-variant">{subject.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-cops-outline-variant pt-4 text-sm">
            <div>
              <span className="mb-1 block font-mono text-[10px] uppercase text-cops-outline">
                Customer ID
              </span>
              <span className="font-mono font-medium">{subject.customerId}</span>
            </div>
            <div>
              <span className="mb-1 block font-mono text-[10px] uppercase text-cops-outline">
                Phone
              </span>
              <span className="font-mono font-medium">{subject.phone}</span>
            </div>
            <div>
              <span className="mb-1 block font-mono text-[10px] uppercase text-cops-outline">
                Region
              </span>
              <span className="font-medium">GDPR (EU) · synthetic demo</span>
            </div>
            <div>
              <span className="mb-1 block font-mono text-[10px] uppercase text-cops-outline">
                Data
              </span>
              <span className="font-medium text-cops-on-surface-variant">Fictional only</span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4 md:w-64">
          <div className="rounded border border-cops-outline-variant bg-cops-surface-container-low p-3 text-[13px] text-cops-on-surface-variant">
            <Info className="mb-1 block h-4 w-4 text-cops-secondary" aria-hidden />
            Initiate a scan across connected sources to locate records matching this synthetic subject.
          </div>
          <PrimaryButton variant="secondary" onClick={onScan} loading={loading}>
            <Search className="h-4 w-4" aria-hidden />
            Scan data spread
          </PrimaryButton>
          {scanned && (
            <p className="flex items-center gap-1 text-[13px] text-cops-on-tertiary-container">
              <History className="h-3.5 w-3.5" aria-hidden />
              Scan complete — review connectors and spread below.
            </p>
          )}
        </div>
      </div>
    </StepPanel>
  );
}

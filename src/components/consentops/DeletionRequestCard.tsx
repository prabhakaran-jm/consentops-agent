import { Search } from "lucide-react";

import type { ConsentSubject } from "@/lib/warehouse/types";

import { Panel, PrimaryButton } from "./ui";

type Props = {
  subject: ConsentSubject;
  onScan: () => void;
  loading: boolean;
  scanned: boolean;
};

export function DeletionRequestCard({ subject, onScan, loading, scanned }: Props) {
  return (
    <Panel title="Deletion request" step={1}>
      <p className="text-sm text-slate-600">
        Demo consent withdrawal for a synthetic subject. Data is fictional only.
      </p>
      <dl className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Name</dt>
          <dd className="font-medium text-slate-900">{subject.fullName}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Customer ID</dt>
          <dd className="font-mono text-slate-900">{subject.customerId}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd className="font-mono text-slate-900">{subject.email}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Phone</dt>
          <dd className="font-mono text-slate-900">{subject.phone}</dd>
        </div>
      </dl>
      <PrimaryButton onClick={onScan} loading={loading}>
        <Search className="h-4 w-4" aria-hidden />
        Scan data spread
      </PrimaryButton>
      {scanned && (
        <p className="text-sm text-emerald-700">Scan complete — review connectors and spread below.</p>
      )}
    </Panel>
  );
}

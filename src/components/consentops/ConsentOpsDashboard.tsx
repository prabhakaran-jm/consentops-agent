"use client";

import { useEffect, useMemo, useState } from "react";

import { demoSubject } from "@/lib/demo/seedData";
import { AGENT_ENGINE_PLAYGROUND_URL } from "@/lib/demo/publicLinks";
import type { PlatformStatus } from "@/lib/platform/platformStatus";
import type { CleanupPlan, ConsentSubject } from "@/lib/warehouse/types";

import { ApprovalPanel } from "./ApprovalPanel";
import { AuditReportPanel } from "./AuditReportPanel";
import { CleanupPlanPanel } from "./CleanupPlanPanel";
import { DashboardSidebar } from "./DashboardSidebar";
import { DataSpreadMapPanel } from "./DataSpreadMapPanel";
import { DeletionRequestCard } from "./DeletionRequestCard";
import { FivetranConnectorPanel } from "./FivetranConnectorPanel";
import { HumanInLoopBanner, PlatformStatusPanel } from "./PlatformStatusPanel";
import { PipelineDiscoveryPanel } from "./PipelineDiscoveryPanel";
import { PostScanSummaryHero } from "./PostScanSummaryHero";
import { useScrollSpy } from "./useScrollSpy";
import { WorkflowProgressStepper } from "./WorkflowProgressStepper";
import type {
  AuditResponse,
  ExecuteResponse,
  PlanProvenance,
  PlanResponse,
  ScanResponse,
} from "./types";

const SCROLL_SPY_SECTIONS = [
  "step-1",
  "step-2",
  "step-2b",
  "step-3",
  "step-4",
  "step-5",
  "step-6",
] as const;

export function ConsentOpsDashboard() {
  const [subject] = useState<ConsentSubject>(demoSubject);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [plan, setPlan] = useState<CleanupPlan | null>(null);
  const [planProvenance, setPlanProvenance] = useState<PlanProvenance | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [audit, setAudit] = useState<AuditResponse>({
    status: "no_execution_yet",
    audit: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [executionCompleted, setExecutionCompleted] = useState(false);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const refreshPlatformStatus = async () => {
    const res = await fetch("/api/status");
    if (!res.ok) return;
    setPlatformStatus((await res.json()) as PlatformStatus);
  };

  const refreshAudit = async () => {
    const res = await fetch("/api/audit");
    if (!res.ok) return;
    const data = (await res.json()) as AuditResponse;
    setAudit(data);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingStatus(true);
      try {
        const [auditRes, statusRes] = await Promise.all([fetch("/api/audit"), fetch("/api/status")]);
        if (!active) return;
        if (auditRes.ok) {
          setAudit((await auditRes.json()) as AuditResponse);
        }
        if (statusRes.ok) {
          setPlatformStatus((await statusRes.json()) as PlatformStatus);
        }
      } finally {
        if (active) setLoadingStatus(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleScan = async () => {
    setError(null);
    setLoadingScan(true);
    try {
      const res = await fetch("/api/scan");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Scan failed");
      }
      const data = (await res.json()) as ScanResponse;
      setScan(data);
      setPlan(null);
      setPlanProvenance(null);
      setSelectedIds(new Set());
      setExecutionCompleted(false);
      await Promise.all([refreshAudit(), refreshPlatformStatus()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoadingScan(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!scan) return;
    setError(null);
    setLoadingPlan(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matches: scan.matches }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? body.message ?? "Plan generation failed");
      }
      const data = (await res.json()) as PlanResponse;
      setPlan(data.plan);
      setPlanProvenance({
        source: data.source,
        warning: data.warning,
        blockedActions: data.blockedActions,
      });
      setSelectedIds(new Set());
      setExecutionCompleted(false);
      setAudit({ status: "no_execution_yet", audit: null });
      await refreshPlatformStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan generation failed");
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleExecute = async (): Promise<void> => {
    if (executionCompleted || !plan || selectedIds.size === 0) {
      throw new Error("Select at least one action to execute.");
    }
    setError(null);
    setLoadingExecute(true);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId: `approval_${Date.now()}`,
          approvedActionIds: [...selectedIds],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message ?? body.error ?? "Execution failed");
      }
      const data = body as ExecuteResponse;
      setAudit({ status: "ok", audit: data.audit });
      setSelectedIds(new Set());
      setExecutionCompleted(true);
      await refreshPlatformStatus();
      document.getElementById("step-6")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execution failed");
      throw e;
    } finally {
      setLoadingExecute(false);
    }
  };

  const toggleAction = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!plan) return;
    setSelectedIds(new Set(plan.actions.map((a) => a.id)));
  };

  const auditPending = audit.status === "no_execution_yet";
  const auditReport = audit.status === "ok" ? audit.audit : null;
  const activeStep = useScrollSpy(SCROLL_SPY_SECTIONS);

  const completedStepIds = useMemo(() => {
    const completed = new Set<string>();
    if (scan) {
      completed.add("step-1");
      completed.add("step-2");
      completed.add("step-2b");
      completed.add("step-3");
    }
    if (plan) completed.add("step-4");
    if (executionCompleted) {
      completed.add("step-5");
      completed.add("step-6");
    }
    return completed;
  }, [scan, plan, executionCompleted]);

  const approvalReady = selectedIds.size > 0;

  return (
    <div className="flex min-h-screen bg-cops-surface">
      <DashboardSidebar activeStep={activeStep} completedStepIds={completedStepIds} />

      <main className="flex min-h-screen flex-1 flex-col lg:ml-64">
        <div className="mx-auto w-full max-w-7xl flex-1 space-y-8 p-4 sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-cops-outline-variant pb-6 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-cops-outline">
                Hackathon demo · synthetic data only
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-cops-primary sm:text-4xl">
                ConsentOps Agent
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] text-cops-on-surface-variant">
                Orchestrating right-to-be-forgotten requests across connected data ecosystems. Human-in-the-loop
                required for final deletion execution.
              </p>
            </div>
            <PlatformStatusPanel
              status={platformStatus}
              loading={loadingStatus}
              compact
              plannerWarning={planProvenance?.warning ?? null}
            />
          </div>

          <WorkflowProgressStepper
            scanComplete={Boolean(scan)}
            planComplete={Boolean(plan)}
            approvalReady={approvalReady}
            executionComplete={executionCompleted}
            auditComplete={Boolean(auditReport)}
          />

          {scan && (
            <PostScanSummaryHero scan={scan} platformStatus={platformStatus} />
          )}

          {error && (
            <div
              className="rounded-lg border border-[#FAD2CF] bg-[#FCE8E6] px-4 py-3 text-[13px] text-cops-on-error-container"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
            <div className="space-y-8 xl:col-span-8">
              <DeletionRequestCard
                subject={subject}
                onScan={handleScan}
                loading={loadingScan}
                scanned={Boolean(scan)}
              />
              <DataSpreadMapPanel
                spreadMap={scan?.spreadMap ?? null}
                matches={scan?.matches ?? null}
                beforeCount={scan?.beforeCount ?? null}
                planReady={Boolean(plan)}
              />
              <CleanupPlanPanel
                plan={plan}
                provenance={planProvenance}
                onGenerate={handleGeneratePlan}
                loading={loadingPlan}
                canGenerate={Boolean(scan)}
                geminiModel={platformStatus?.gemini.model}
              />
              <ApprovalPanel
                plan={plan}
                selectedIds={selectedIds}
                onToggle={toggleAction}
                onSelectAll={selectAll}
                onClear={() => setSelectedIds(new Set())}
                onExecute={handleExecute}
                loading={loadingExecute}
                executionCompleted={executionCompleted}
              />
              <AuditReportPanel audit={auditReport} pending={auditPending} />
            </div>

            <div className="space-y-6 xl:col-span-4 xl:sticky xl:top-8">
              <FivetranConnectorPanel fivetran={scan?.fivetran ?? null} />
              <PipelineDiscoveryPanel
                mcpTrace={scan?.mcpTrace ?? null}
                pipelineLineage={scan?.pipelineLineage ?? null}
                discoverySource={scan?.fivetranDiscoverySource ?? null}
                toolsRun={scan?.mcpToolsRun ?? null}
              />
              <HumanInLoopBanner />
            </div>
          </div>

          <details
            id="platform-status"
            className="scroll-mt-24 rounded-lg border border-cops-outline-variant bg-cops-surface-container-lowest"
          >
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-cops-secondary">
              Full platform status (judges)
            </summary>
            <div className="border-t border-cops-outline-variant p-2">
              <PlatformStatusPanel
                status={platformStatus}
                loading={loadingStatus}
                plannerWarning={planProvenance?.warning ?? null}
              />
            </div>
          </details>
        </div>

        <footer className="mt-auto border-t border-cops-outline-variant bg-cops-surface-container-lowest py-6">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-8">
            <p className="font-mono text-xs text-cops-on-surface-variant">
              © {new Date().getFullYear()} ConsentOps Agent — Technical precision &amp; transparency
            </p>
            <div className="flex flex-wrap gap-6 font-mono text-xs text-cops-on-surface-variant">
              <a href="/api/status" className="hover:text-cops-primary hover:underline">
                System status
              </a>
              <a
                href={AGENT_ENGINE_PLAYGROUND_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cops-primary hover:underline"
              >
                Agent Engine playground
              </a>
              <span>Synthetic demo only</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { buildDemoPlan, runDemoScan } from "@/lib/demo/demoWorkflowService";

const EXECUTION_SHAPED_KEYS = [
  "approvalId",
  "approvedActionIds",
  "approvedBy",
  "execute",
  "execution",
  "cleanupActions",
  "actionsToExecute",
] as const;

const AgentPlanRequestSchema = z
  .object({
    subject: z
      .object({
        id: z.string().min(1).optional(),
        fullName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().min(1).optional(),
        customerId: z.string().min(1).optional(),
        emailSha256: z.string().min(1).optional(),
      })
      .partial()
      .strict()
      .optional(),
  })
  .strict();

const rejectExecutionShapedBody = (raw: unknown): string | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const keys = Object.keys(raw);
  const forbidden = keys.filter((key) =>
    EXECUTION_SHAPED_KEYS.includes(key as (typeof EXECUTION_SHAPED_KEYS)[number]),
  );
  if (forbidden.length > 0) {
    return `Agent endpoint cannot accept execution fields: ${forbidden.join(", ")}. Use the web UI for approval and execute.`;
  }
  return null;
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const executionRejectReason = rejectExecutionShapedBody(rawBody);
    if (executionRejectReason) {
      return NextResponse.json({ error: executionRejectReason }, { status: 400 });
    }

    const body = AgentPlanRequestSchema.parse(rawBody);
    const scan = await runDemoScan();
    const planResult = await buildDemoPlan({
      subject: body?.subject,
      matches: scan.matches,
    });

    return NextResponse.json({
      capability: "scan_and_plan_only",
      disclaimer:
        "Synthetic demo data only. This endpoint does not execute cleanup. Human approval and execution remain in the ConsentOps web UI.",
      scan: {
        subject: scan.subject,
        fivetran: scan.fivetran,
        beforeCount: scan.beforeCount,
        spreadMap: scan.spreadMap,
        matchCount: scan.matches.length,
      },
      plan: planResult.plan,
      source: planResult.source,
      warning: planResult.warning,
      blockedActions: planResult.blockedActions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unexpected agent plan failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

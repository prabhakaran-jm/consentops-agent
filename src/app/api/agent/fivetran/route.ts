import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getFivetranPublicAliasMap,
  invokeFivetranReadOnlyTool,
} from "@/lib/connectors/fivetranAgentBridge";
import {
  resolveSanitizedToolArguments,
  sanitizeFivetranAgentToolResult,
} from "@/lib/connectors/fivetranPublicSanitizer";

const EXECUTION_SHAPED_KEYS = [
  "approvalId",
  "approvedActionIds",
  "approvedBy",
  "execute",
  "execution",
  "cleanupActions",
  "actionsToExecute",
] as const;

const AgentFivetranRequestSchema = z
  .object({
    tool: z.enum([
      "get_account_info",
      "list_connections",
      "get_connection_details",
      "get_connection_state",
      "list_destinations",
    ]),
    arguments: z.record(z.string(), z.unknown()).optional(),
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

    const body = AgentFivetranRequestSchema.parse(rawBody);
    const aliasMap = await getFivetranPublicAliasMap();
    const resolvedArgs = resolveSanitizedToolArguments(
      body.tool,
      body.arguments ?? {},
      aliasMap,
    );
    const result = await invokeFivetranReadOnlyTool(body.tool, resolvedArgs);

    return NextResponse.json(sanitizeFivetranAgentToolResult(result, aliasMap));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unexpected Fivetran agent tool failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

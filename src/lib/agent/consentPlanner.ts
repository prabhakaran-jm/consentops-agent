import { z } from "zod";

import { DEMO_BLOCKED_ACTION_POLICIES } from "@/lib/audit/auditReport";
import type { GeminiClient } from "@/lib/agent/geminiClient";
import { createGeminiClient, getGeminiConfigFromEnv } from "@/lib/agent/geminiClient";
import type {
  CleanupAction,
  CleanupPlan,
  ConsentSubject,
  DataMatch,
  WarehouseTableName,
} from "@/lib/warehouse/types";

const WAREHOUSE_TABLE_NAMES = [
  "crm_customers",
  "commerce_orders",
  "support_tickets",
  "marketing_email_events",
  "analytics_customer_360",
  "ai_training_feedback_export",
  "payments_transactions",
] as const;

const TABLE_WIDE_MARKERS = new Set(["*", "all", "table_wide", "table-wide", "ALL"]);

const LEGAL_CLAIM_PATTERNS = [
  /gdpr compliant/i,
  /legally compliant/i,
  /certifies compliance/i,
  /legal proof/i,
  /forensic certainty/i,
];

const REVIEW_RECORD_IDS = new Set<string>([
  "ai_training_feedback_export_007",
  "support_tickets_005",
]);

const ANONYMIZE_TABLES = new Set<WarehouseTableName>([
  "marketing_email_events",
  "analytics_customer_360",
  "ai_training_feedback_export",
]);

export type PlannerSource = "deterministic" | "gemini";

export interface PlannerInput {
  subject: ConsentSubject;
  matches: DataMatch[];
}

export interface PlannerResult {
  plan: CleanupPlan;
  source: PlannerSource;
  warning?: string;
  blockedActions: string[];
}

const CleanupActionSchema = z
  .object({
    id: z.string().min(1),
    table: z.enum(WAREHOUSE_TABLE_NAMES),
    recordIds: z.array(z.string().min(1)).min(1),
    classification: z.enum(["delete", "anonymize", "retain", "review"]),
    fields: z.array(z.string().min(1)),
    retainReason: z.string().optional(),
  })
  .strict();

const CleanupPlanSchema = z
  .object({
    id: z.string().min(1),
    subjectId: z.string().min(1),
    createdAtIso: z.string().min(1),
    totalMatchesBeforeCleanup: z.number().int().nonnegative(),
    actions: z.array(CleanupActionSchema).min(1),
  })
  .strict();

const GeminiPlannerResponseSchema = z
  .object({
    plan: CleanupPlanSchema,
    blockedActions: z.array(z.string().min(1)).optional(),
    planningNotes: z.string().optional(),
  })
  .strict();

export type GeminiPlannerResponse = z.infer<typeof GeminiPlannerResponseSchema>;

const actionForMatch = (match: DataMatch, index: number): CleanupAction => {
  const recordId = match.recordId;
  const table = match.table;
  const fields = [...match.matchedFields];

  if (table === "payments_transactions") {
    return {
      id: `act_${String(index + 1).padStart(3, "0")}`,
      table,
      recordIds: [recordId],
      classification: "retain",
      fields: [...fields, "amount"],
      retainReason: "Financial retention review required",
    };
  }

  if (REVIEW_RECORD_IDS.has(recordId)) {
    return {
      id: `act_${String(index + 1).padStart(3, "0")}`,
      table,
      recordIds: [recordId],
      classification: "review",
      fields,
    };
  }

  if (ANONYMIZE_TABLES.has(table)) {
    return {
      id: `act_${String(index + 1).padStart(3, "0")}`,
      table,
      recordIds: [recordId],
      classification: "anonymize",
      fields,
    };
  }

  return {
    id: `act_${String(index + 1).padStart(3, "0")}`,
    table,
    recordIds: [recordId],
    classification: "delete",
    fields,
  };
};

export const buildDeterministicCleanupPlan = (
  subject: ConsentSubject,
  matches: DataMatch[],
): CleanupPlan => ({
  id: `plan_det_${Date.now()}`,
  subjectId: subject.id,
  createdAtIso: new Date().toISOString(),
  totalMatchesBeforeCleanup: matches.length,
  actions: matches.map((match, index) => actionForMatch(match, index)),
});

export const buildGeminiPlannerPrompt = (input: PlannerInput): string => {
  const matchSummary = input.matches.map((match) => ({
    table: match.table,
    recordId: match.recordId,
    matchedFields: match.matchedFields,
    confidence: match.confidence,
    suggestedSensitivity: match.suggestedSensitivity,
  }));

  return [
    "You are ConsentOps, a demo consent-withdrawal planning assistant for synthetic data only.",
    "Return strict JSON only with this shape:",
    "{",
    '  "plan": {',
    '    "id": string,',
    '    "subjectId": string,',
    '    "createdAtIso": ISO-8601 string,',
    '    "totalMatchesBeforeCleanup": number,',
    '    "actions": [',
    "      {",
    '        "id": string,',
    '        "table": one of warehouse table names,',
    '        "recordIds": [single explicit record id],',
    '        "classification": "delete" | "anonymize" | "retain" | "review",',
    '        "fields": string[],',
    '        "retainReason": string (required when classification is retain)',
    "      }",
    "    ]",
    "  },",
    '  "blockedActions": string[] (policy items that must not be auto-executed),',
    '  "planningNotes": string (optional, must NOT claim legal compliance)',
    "}",
    "",
    "Rules:",
    "- Classify every matched record with exactly one record-scoped action.",
    "- Never use table-wide deletion or wildcard record IDs.",
    "- payments_transactions records must be retain only with retainReason.",
    "- Human approval is required before any cleanup executes.",
    "- Do not claim GDPR compliance, legal proof, or forensic certainty.",
    "- Identify blocked actions explicitly in blockedActions.",
    "",
    `Subject: ${JSON.stringify(input.subject)}`,
    `Matches: ${JSON.stringify(matchSummary)}`,
  ].join("\n");
};

export const validateCleanupPlanSafety = (
  plan: CleanupPlan,
  matches: DataMatch[],
): { ok: true } | { ok: false; reason: string } => {
  const allowedRecordIds = new Set(matches.map((match) => match.recordId));
  const serialized = JSON.stringify(plan);

  for (const pattern of LEGAL_CLAIM_PATTERNS) {
    if (pattern.test(serialized)) {
      return { ok: false, reason: "Plan claims legal or forensic compliance." };
    }
  }

  if (plan.totalMatchesBeforeCleanup !== matches.length) {
    return { ok: false, reason: "Plan totalMatchesBeforeCleanup does not match scan results." };
  }

  const seenRecordIds = new Set<string>();

  for (const action of plan.actions) {
    if (action.recordIds.length !== 1) {
      return { ok: false, reason: `Action '${action.id}' must target exactly one record ID.` };
    }

    const recordId = action.recordIds[0]!;
    if (TABLE_WIDE_MARKERS.has(recordId)) {
      return { ok: false, reason: `Action '${action.id}' uses blocked table-wide marker.` };
    }

    if (!allowedRecordIds.has(recordId)) {
      return { ok: false, reason: `Action '${action.id}' targets unknown record '${recordId}'.` };
    }

    if (seenRecordIds.has(recordId)) {
      return { ok: false, reason: `Duplicate action for record '${recordId}'.` };
    }
    seenRecordIds.add(recordId);

    if (
      action.table === "payments_transactions" &&
      (action.classification === "delete" || action.classification === "anonymize")
    ) {
      return {
        ok: false,
        reason: "Payment transaction records cannot be deleted or anonymized.",
      };
    }

    if (action.classification === "retain" && !action.retainReason?.trim()) {
      return { ok: false, reason: `Retain action '${action.id}' is missing retainReason.` };
    }
  }

  for (const recordId of allowedRecordIds) {
    if (!seenRecordIds.has(recordId)) {
      return { ok: false, reason: `Matched record '${recordId}' has no cleanup action.` };
    }
  }

  return { ok: true };
};

export const parseGeminiPlannerResponse = (
  raw: string,
  input: PlannerInput,
): { ok: true; value: GeminiPlannerResponse } | { ok: false; reason: string } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "Gemini response is not valid JSON." };
  }

  const schemaResult = GeminiPlannerResponseSchema.safeParse(parsed);
  if (!schemaResult.success) {
    return { ok: false, reason: `Gemini plan schema invalid: ${schemaResult.error.message}` };
  }

  if (schemaResult.data.plan.subjectId !== input.subject.id) {
    return { ok: false, reason: "Gemini plan subjectId does not match request subject." };
  }

  const safety = validateCleanupPlanSafety(schemaResult.data.plan, input.matches);
  if (!safety.ok) {
    return { ok: false, reason: safety.reason };
  }

  return { ok: true, value: schemaResult.data };
};

const deterministicResult = (
  input: PlannerInput,
  warning?: string,
): PlannerResult => ({
  plan: buildDeterministicCleanupPlan(input.subject, input.matches),
  source: "deterministic",
  warning,
  blockedActions: [...DEMO_BLOCKED_ACTION_POLICIES],
});

export const planConsentCleanup = async (
  input: PlannerInput,
  options?: { geminiClient?: GeminiClient | null; forceDeterministic?: boolean },
): Promise<PlannerResult> => {
  const fallback = (warning?: string) => deterministicResult(input, warning);

  if (options?.forceDeterministic) {
    return fallback();
  }

  const config = getGeminiConfigFromEnv();
  if (!config) {
    return fallback();
  }

  const client = options?.geminiClient ?? createGeminiClient(config);

  try {
    const raw = await client.generateJson(buildGeminiPlannerPrompt(input));
    const parsed = parseGeminiPlannerResponse(raw, input);
    if (!parsed.ok) {
      return fallback(`Gemini plan rejected (${parsed.reason}). Using deterministic fallback.`);
    }

    return {
      plan: parsed.value.plan,
      source: "gemini",
      blockedActions: parsed.value.blockedActions ?? [...DEMO_BLOCKED_ACTION_POLICIES],
      warning: parsed.value.planningNotes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini request failed";
    return fallback(`Gemini unavailable (${message}). Using deterministic fallback.`);
  }
};

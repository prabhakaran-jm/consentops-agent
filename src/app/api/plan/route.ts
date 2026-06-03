import { NextResponse } from "next/server";
import { z } from "zod";

import { buildDemoPlan } from "@/lib/demo/demoWorkflowService";
import { MATCH_FIELDS } from "@/lib/warehouse/types";

const DataMatchSchema = z
  .object({
    table: z.enum([
      "crm_customers",
      "commerce_orders",
      "support_tickets",
      "marketing_email_events",
      "analytics_customer_360",
      "ai_training_feedback_export",
      "payments_transactions",
    ]),
    recordId: z.string().min(1),
    matchedFields: z
      .array(
        z.enum([
          MATCH_FIELDS.email,
          MATCH_FIELDS.phone,
          MATCH_FIELDS.customerId,
          MATCH_FIELDS.emailSha256,
        ]),
      )
      .min(1),
    confidence: z.enum(["high", "medium", "low"]),
    suggestedSensitivity: z.enum([
      "direct_identifier",
      "derived_identifier",
      "free_text",
      "transaction_record",
    ]),
  })
  .strict();

const PlanRequestSchema = z
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
    matches: z.array(DataMatchSchema).optional(),
  })
  .strict()
  .optional();

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const body = PlanRequestSchema.parse(rawBody);
    const result = await buildDemoPlan(body);
    return NextResponse.json({
      plan: result.plan,
      source: result.source,
      warning: result.warning,
      blockedActions: result.blockedActions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unexpected plan failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

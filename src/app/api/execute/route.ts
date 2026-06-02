import { NextResponse } from "next/server";
import { z } from "zod";

import { DemoWorkflowError, executeDemoPlan } from "@/lib/demo/demoWorkflowService";

const ExecuteRequestSchema = z
  .object({
    approvalId: z.string().min(1),
    approvedActionIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const body = ExecuteRequestSchema.parse(rawBody);
    const result = await executeDemoPlan(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.issues }, { status: 400 });
    }
    if (error instanceof DemoWorkflowError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Unexpected execution failure";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

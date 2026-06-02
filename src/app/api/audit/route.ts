import { NextResponse } from "next/server";

import { getLatestDemoAudit } from "@/lib/demo/demoWorkflowService";

export async function GET() {
  try {
    const audit = await getLatestDemoAudit();
    if (!audit) {
      return NextResponse.json({
        status: "no_execution_yet",
        audit: null,
      });
    }
    return NextResponse.json({ status: "ok", audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected audit failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

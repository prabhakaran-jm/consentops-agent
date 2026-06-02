import { NextResponse } from "next/server";

import { runDemoScan } from "@/lib/demo/demoWorkflowService";

export async function GET() {
  try {
    const payload = await runDemoScan();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected scan failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

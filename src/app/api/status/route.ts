import { NextResponse } from "next/server";

import { getPlatformStatus } from "@/lib/platform/platformStatus";

export async function GET() {
  try {
    return NextResponse.json(getPlatformStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected status failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

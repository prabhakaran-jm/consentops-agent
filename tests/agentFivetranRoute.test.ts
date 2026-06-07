import { describe, expect, it } from "vitest";

import { POST as postAgentFivetranRoute } from "@/app/api/agent/fivetran/route";

describe("POST /api/agent/fivetran", () => {
  it("returns list_connections via adapter fallback in tests", async () => {
    const response = await postAgentFivetranRoute(
      new Request("http://localhost/api/agent/fivetran", {
        method: "POST",
        body: JSON.stringify({ tool: "list_connections" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.capability).toBe("fivetran_read_only");
    expect(body.tool).toBe("list_connections");
    expect(body.source).toBe("mock");
    expect(body.disclaimer).toMatch(/read-only/i);
    expect(body.data?.data?.items?.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/conn_[a-z0-9_]+/i);
    expect(body.data?.data?.items?.every((item: { id: string }) => item.id.startsWith("connector_"))).toBe(
      true,
    );
  });

  it("returns get_account_info via adapter fallback", async () => {
    const response = await postAgentFivetranRoute(
      new Request("http://localhost/api/agent/fivetran", {
        method: "POST",
        body: JSON.stringify({ tool: "get_account_info" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tool).toBe("get_account_info");
    expect(body.data).toBeTruthy();
  });

  it("rejects unknown tools", async () => {
    const response = await postAgentFivetranRoute(
      new Request("http://localhost/api/agent/fivetran", {
        method: "POST",
        body: JSON.stringify({ tool: "trigger_sync" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects execution-shaped payloads", async () => {
    const response = await postAgentFivetranRoute(
      new Request("http://localhost/api/agent/fivetran", {
        method: "POST",
        body: JSON.stringify({ tool: "list_connections", execute: true }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/execution fields/i);
  });
});

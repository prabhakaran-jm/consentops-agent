import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GeminiClient } from "@/lib/agent/geminiClient";
import {
  buildDeterministicCleanupPlan,
  planConsentCleanup,
} from "@/lib/agent/consentPlanner";
import { demoSubject, demoWarehouseTables } from "@/lib/demo/seedData";
import { scanSubjectAcrossWarehouse } from "@/lib/warehouse/localWarehouse";
import type { DataMatch, WarehouseTableName } from "@/lib/warehouse/types";

const originalApiKey = process.env.GEMINI_API_KEY;

const makeMatch = (
  table: WarehouseTableName,
  recordId: string,
): DataMatch => ({
  table,
  recordId,
  matchedFields: ["email", "customerId"],
  confidence: "high",
  suggestedSensitivity: "direct_identifier",
});

const buildValidGeminiPayload = (matches: DataMatch[]) => ({
  plan: {
    id: "plan_gemini_test",
    subjectId: demoSubject.id,
    createdAtIso: "2026-06-02T10:00:00.000Z",
    totalMatchesBeforeCleanup: matches.length,
    actions: matches.map((match, index) => {
      if (match.table === "payments_transactions") {
        return {
          id: `act_gem_${String(index + 1).padStart(3, "0")}`,
          table: match.table,
          recordIds: [match.recordId],
          classification: "retain" as const,
          fields: ["email"],
          retainReason: "Financial retention review required",
        };
      }
      return {
        id: `act_gem_${String(index + 1).padStart(3, "0")}`,
        table: match.table,
        recordIds: [match.recordId],
        classification: "delete" as const,
        fields: ["email", "customerId"],
      };
    }),
  },
  blockedActions: ["No cleanup execution without explicit human approval."],
  planningNotes: "Demo plan only; human approval required before execution.",
});

describe("consent planner", () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
    vi.restoreAllMocks();
  });

  it("uses deterministic planner when GEMINI_API_KEY is missing", async () => {
    const matches = scanSubjectAcrossWarehouse(demoSubject, demoWarehouseTables).slice(0, 3);
    const result = await planConsentCleanup({ subject: demoSubject, matches });

    expect(result.source).toBe("deterministic");
    expect(result.warning).toBeUndefined();
    expect(result.plan.actions).toHaveLength(3);
    expect(result.plan.actions[0]?.recordIds).toHaveLength(1);
    expect(result.blockedActions.length).toBeGreaterThan(0);
  });

  it("accepts a valid mocked Gemini plan", async () => {
    const matches = [makeMatch("crm_customers", "crm_customers_001")];
    const mockClient: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(JSON.stringify(buildValidGeminiPayload(matches))),
    };

    process.env.GEMINI_API_KEY = "test-key";

    const result = await planConsentCleanup(
      { subject: demoSubject, matches },
      { geminiClient: mockClient },
    );

    expect(result.source).toBe("gemini");
    expect(result.plan.id).toBe("plan_gemini_test");
    expect(result.plan.actions[0]?.classification).toBe("delete");
    expect(mockClient.generateJson).toHaveBeenCalledOnce();
  });

  it("rejects invalid Gemini JSON schema and falls back", async () => {
    const matches = [makeMatch("crm_customers", "crm_customers_001")];
    const mockClient: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          plan: {
            id: "bad",
            subjectId: demoSubject.id,
            createdAtIso: "2026-06-02T10:00:00.000Z",
            totalMatchesBeforeCleanup: 1,
            actions: [
              {
                id: "act_bad",
                table: "crm_customers",
                recordIds: ["crm_customers_001"],
                classification: "retain",
                fields: ["email"],
              },
            ],
          },
        }),
      ),
    };

    process.env.GEMINI_API_KEY = "test-key";

    const result = await planConsentCleanup(
      { subject: demoSubject, matches },
      { geminiClient: mockClient },
    );

    expect(result.source).toBe("deterministic");
    expect(result.warning).toMatch(/Gemini plan rejected/i);
    expect(result.plan.actions[0]?.classification).toBe("delete");
  });

  it("rejects unsafe Gemini plans and falls back", async () => {
    const matches = [makeMatch("payments_transactions", "payments_transactions_001")];
    const mockClient: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          plan: {
            id: "plan_unsafe",
            subjectId: demoSubject.id,
            createdAtIso: "2026-06-02T10:00:00.000Z",
            totalMatchesBeforeCleanup: 1,
            actions: [
              {
                id: "act_unsafe",
                table: "payments_transactions",
                recordIds: ["payments_transactions_001"],
                classification: "delete",
                fields: ["email"],
              },
            ],
          },
        }),
      ),
    };

    process.env.GEMINI_API_KEY = "test-key";

    const result = await planConsentCleanup(
      { subject: demoSubject, matches },
      { geminiClient: mockClient },
    );

    expect(result.source).toBe("deterministic");
    expect(result.warning).toMatch(/Payment transaction records cannot be deleted/i);
    expect(result.plan.actions[0]?.classification).toBe("retain");
    expect(result.plan.actions[0]?.retainReason).toBeTruthy();
  });

  it("rejects a schema-valid Gemini plan that smuggles a table-wide wildcard record id", async () => {
    // "*" is a valid non-empty string, so it passes zod; the deterministic
    // safety validator must still reject it and fall back.
    const matches = [makeMatch("crm_customers", "crm_customers_001")];
    const mockClient: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          plan: {
            id: "plan_wildcard",
            subjectId: demoSubject.id,
            createdAtIso: "2026-06-02T10:00:00.000Z",
            totalMatchesBeforeCleanup: 1,
            actions: [
              {
                id: "act_wildcard",
                table: "crm_customers",
                recordIds: ["*"],
                classification: "delete",
                fields: ["email"],
              },
            ],
          },
        }),
      ),
    };

    process.env.GEMINI_API_KEY = "test-key";

    const result = await planConsentCleanup(
      { subject: demoSubject, matches },
      { geminiClient: mockClient },
    );

    expect(result.source).toBe("deterministic");
    expect(result.warning).toMatch(/table-wide marker/i);
    // Fallback plan targets the real record explicitly, never the wildcard.
    expect(result.plan.actions).toHaveLength(1);
    expect(result.plan.actions[0]?.recordIds).toEqual(["crm_customers_001"]);
  });

  it("falls back when Gemini call fails", async () => {
    const matches = [makeMatch("crm_customers", "crm_customers_001")];
    const mockClient: GeminiClient = {
      generateJson: vi.fn().mockRejectedValue(new Error("network timeout")),
    };

    process.env.GEMINI_API_KEY = "test-key";

    const result = await planConsentCleanup(
      { subject: demoSubject, matches },
      { geminiClient: mockClient },
    );

    expect(result.source).toBe("deterministic");
    expect(result.warning).toMatch(/Gemini unavailable/i);
    expect(result.plan.actions).toHaveLength(1);
  });

  it("deterministic planner retains payment records only", () => {
    const matches = scanSubjectAcrossWarehouse(demoSubject, demoWarehouseTables);
    const plan = buildDeterministicCleanupPlan(demoSubject, matches);
    const paymentActions = plan.actions.filter(
      (action) => action.table === "payments_transactions",
    );

    expect(paymentActions.length).toBeGreaterThan(0);
    expect(paymentActions.every((action) => action.classification === "retain")).toBe(true);
    expect(paymentActions.every((action) => Boolean(action.retainReason?.trim()))).toBe(true);
  });
});

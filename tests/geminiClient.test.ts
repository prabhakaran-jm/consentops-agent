import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGeminiClient, DEFAULT_GEMINI_MODEL, getGeminiConfigFromEnv } from "@/lib/agent/geminiClient";
import { planConsentCleanup } from "@/lib/agent/consentPlanner";
import { demoSubject } from "@/lib/demo/seedData";
import type { DataMatch } from "@/lib/warehouse/types";

const TEST_API_KEY = "secret-gemini-key-for-tests-12345";
const TEST_PROMPT = "Plan cleanup for synthetic subject subj_ana_reyes";
const originalApiKey = process.env.GEMINI_API_KEY;

const makeMatch = (): DataMatch => ({
  table: "crm_customers",
  recordId: "crm_customers_001",
  matchedFields: ["email", "customerId"],
  confidence: "high",
  suggestedSensitivity: "direct_identifier",
});

describe("gemini client", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        }),
        text: async () => "",
      }),
    );
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("defaults to Gemini 3.5 Flash when GEMINI_MODEL is unset", () => {
    process.env.GEMINI_API_KEY = TEST_API_KEY;
    delete process.env.GEMINI_MODEL;

    const config = getGeminiConfigFromEnv();
    expect(config?.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.5-flash");
  });

  it("sends the API key in x-goog-api-key header, not the URL", async () => {
    const client = createGeminiClient({ apiKey: TEST_API_KEY, model: DEFAULT_GEMINI_MODEL });
    await client.generateJson(TEST_PROMPT);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain(TEST_API_KEY);
    expect(String(url)).not.toMatch(/[?&]key=/);

    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get("x-goog-api-key")).toBe(TEST_API_KEY);
  });

  it("includes the prompt in the request body but not the API key", async () => {
    const client = createGeminiClient({ apiKey: TEST_API_KEY, model: DEFAULT_GEMINI_MODEL });
    await client.generateJson(TEST_PROMPT);

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const body = String(init?.body);

    expect(body).toContain(TEST_PROMPT);
    expect(body).not.toContain(TEST_API_KEY);
  });

  it("redacts the API key from Gemini error responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => `Invalid API key: ${TEST_API_KEY}`,
      }),
    );

    const client = createGeminiClient({ apiKey: TEST_API_KEY, model: DEFAULT_GEMINI_MODEL });

    let thrown: unknown;
    try {
      await client.generateJson(TEST_PROMPT);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain("[REDACTED]");
    expect(message).not.toContain(TEST_API_KEY);
  });

  it("falls back to deterministic planning when the Gemini fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network timeout")));

    process.env.GEMINI_API_KEY = TEST_API_KEY;

    const result = await planConsentCleanup({
      subject: demoSubject,
      matches: [makeMatch()],
    });

    expect(result.source).toBe("deterministic");
    expect(result.warning).toMatch(/Gemini unavailable/i);
    expect(result.warning).not.toContain(TEST_API_KEY);
    expect(result.plan.actions).toHaveLength(1);
  });
});

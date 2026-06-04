export interface GeminiClient {
  generateJson(prompt: string): Promise<string>;
}

export interface GeminiClientConfig {
  apiKey: string;
  model: string;
}

export const getGeminiConfigFromEnv = (): GeminiClientConfig | null => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
  };
};

const redactApiKey = (text: string, apiKey: string): string => {
  if (!apiKey) return text;
  let redacted = text.includes(apiKey) ? text.split(apiKey).join("[REDACTED]") : text;
  redacted = redacted.replace(/([?&]key=)[^&\s"']+/gi, "$1[REDACTED]");
  return redacted;
};

export const createGeminiClient = (config: GeminiClientConfig): GeminiClient => ({
  async generateJson(prompt: string): Promise<string> {
    // This demo uses synthetic subject data only. Do not send real personal data to Gemini without a proper privacy review.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Gemini API error (${response.status}): ${redactApiKey(errorBody, config.apiKey)}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini API returned empty content.");
    }

    return text;
  },
});

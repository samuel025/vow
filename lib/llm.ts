/** Tiny provider-agnostic LLM client. Claude if ANTHROPIC_API_KEY is set, else Gemini. Returns null when no key is configured. */
export const llmProvider = () => (process.env.ANTHROPIC_API_KEY ? "claude" : process.env.GEMINI_API_KEY ? "gemini" : null);

async function call(system: string, user: string, opts: { json?: boolean; maxTokens?: number }): Promise<string | null> {
  const p = llmProvider(); if (!p) return null;
  const ctl = AbortSignal.timeout(20_000);
  if (p === "claude") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: opts.maxTokens ?? 600, system, messages: [{ role: "user", content: user }] }),
    });
    if (!r.ok) throw new Error(`Claude ${r.status}`);
    return (await r.json()).content?.[0]?.text ?? null;
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", signal: ctl,
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 600, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 }, ...(opts.json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  return (await r.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

/** One retry on rate limits / transient overload. */
export async function complete(system: string, user: string, opts: { json?: boolean; maxTokens?: number } = {}): Promise<string | null> {
  try { return await call(system, user, opts); }
  catch (e) {
    if (!/ (429|500|502|503)$/.test(String(e))) throw e;
    await new Promise((r) => setTimeout(r, /429$/.test(String(e)) ? 4000 : 1200));
    return call(system, user, opts);
  }
}

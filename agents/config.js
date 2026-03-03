/**
 * Shared configuration for all agents.
 * Centralizes API key management and Gemini model initialization.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── API Keys ──────────────────────────────────────────────────────────────────
export const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || "AIzaSyDGh0rfQFxWR_XRkcbDxRxCXk3vNrboZkw";

if (!GEMINI_API_KEY) {
  throw new Error(
    "Missing GEMINI_API_KEY. Set it as an environment variable before running."
  );
}

export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ── Model Discovery & Selection ───────────────────────────────────────────────
const PREFERRED_MODELS = [
  "models/gemini-2.5-flash",
  "models/gemini-2.5-pro",
  "models/gemini-pro-latest",
  "models/gemini-flash-latest",
];

let resolvedModelName = process.env.GEMINI_MODEL_NAME || null;

async function listModels() {
  const url = "https://generativelanguage.googleapis.com/v1beta/models";
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
  });
  return res.json();
}

function pickModel(modelsResp) {
  const list = modelsResp?.models ?? [];
  for (const p of PREFERRED_MODELS) {
    const found = list.find(
      (m) =>
        m.name?.startsWith(p) &&
        m.supportedGenerationMethods?.includes("generateContent")
    );
    if (found) return found.name;
  }
  const fallback = list.find((m) =>
    m.supportedGenerationMethods?.includes("generateContent")
  );
  return fallback?.name ?? null;
}

/**
 * Returns a Gemini GenerativeModel (text-only, no tool declarations).
 * All tool execution is handled in code; LLM is used for analysis & synthesis.
 */
export async function getModel() {
  if (!resolvedModelName) {
    try {
      const resp = await listModels();
      resolvedModelName = pickModel(resp) || "models/gemini-2.5-flash";
      console.log(`  [config] Selected model: ${resolvedModelName}`);
    } catch {
      resolvedModelName = "models/gemini-2.5-flash";
    }
  }

  return genAI.getGenerativeModel({ model: resolvedModelName });
}

/**
 * Helper: send a prompt to the LLM and get text back.
 */
export async function askLLM(prompt) {
  const model = await getModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

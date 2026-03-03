import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOrderStatus } from "./tools.js";

const API_KEY = process.env.GEMINI_API_KEY ;
if (!API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable. Set GEMINI_API_KEY to your Google Generative AI API key. On Windows (cmd): set GEMINI_API_KEY=YOUR_KEY && node index.js; PowerShell: $env:GEMINI_API_KEY='YOUR_KEY'; or use your system's env var mechanism.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models";
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      }
    });
    return await res.json();
  } catch (e) {
    throw e;
  }
}

let modelInstance = null;
let selectedModelName = process.env.GEMINI_MODEL_NAME || "models/gemini-2.5-pro";

function chooseModelFromList(modelsResp) {
  const preferred = ["models/gemini-2.5-pro", "models/gemini-2.5-flash", "models/gemini-pro-latest", "models/gemini-flash-latest"];
  const list = (modelsResp && modelsResp.models) || [];

  // Try preferred names first
  for (const p of preferred) {
    const found = list.find((m) => m.name && m.name.startsWith(p) && Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"));
    if (found) return found.name;
  }

  // Fallback: first model that supports generateContent
  const fallback = list.find((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"));
  return fallback ? fallback.name : null;
}

async function ensureModelInitialized() {
  if (modelInstance) return modelInstance;

  if (!selectedModelName) {
    try {
      const modelsResp = await listModels();
      selectedModelName = chooseModelFromList(modelsResp);
      console.log("Selected model:", selectedModelName);
    } catch (e) {
      console.error("Could not fetch model list:", e);
    }
  }

  if (!selectedModelName) {
    throw new Error("No suitable model found. Set GEMINI_MODEL_NAME environment variable to a supported model name.");
  }

  modelInstance = genAI.getGenerativeModel({ model: selectedModelName, tools: toolDeclarations });
  return modelInstance;
}

const toolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "getOrderStatus",
        description: "Get order delivery status",
        parameters: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "Order ID"
            }
          },
          required: ["orderId"]
        }
      }
    ]
  }
];


export async function runAgent(history, userInput) {
  const model = await ensureModelInitialized();
  const chat = model.startChat({ history });

  let result;
  try {
    result = await chat.sendMessage(userInput);
  } catch (err) {
    // If the model isn't supported for generateContent, list available models to help debug
    try {
      const models = await listModels();
      console.error("ListModels result (for debugging):", JSON.stringify(models, null, 2));
    } catch (listErr) {
      console.error("Failed to list models:", listErr);
    }
    throw err;
  }
  const response = result.response;

  // Check if Gemini wants to call a function
  const call = response.functionCalls?.[0];

  if (call) {
    const { name, args } = call;

    if (name === "getOrderStatus") {
      const toolResult = await getOrderStatus(args.orderId);

      // Send tool result back to Gemini
      const finalResponse = await chat.sendMessage([
        {
          functionResponse: {
            name,
            response: { result: toolResult }
          }
        }
      ]);

      return finalResponse.response.text();
    }
  }

  return response.text();
}

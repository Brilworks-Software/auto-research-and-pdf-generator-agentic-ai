/**
 * BaseAgent — thin wrapper every specialised agent extends.
 *
 * Responsibilities:
 *  • Holds a system prompt and tool declarations
 *  • Manages a chat session with Gemini
 *  • Implements the tool-call loop (send → detect functionCall → execute → reply)
 */
import { getModel } from "./config.js";

export class BaseAgent {
  /**
   * @param {object}   opts
   * @param {string}   opts.name           – human-readable agent name
   * @param {string}   opts.systemPrompt   – system instruction for this agent
   * @param {Array}    opts.toolDeclarations – Gemini-style function declarations
   * @param {object}   opts.toolHandlers    – { fnName: async (args) => result }
   */
  constructor({ name, systemPrompt, toolDeclarations = [], toolHandlers = {} }) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.toolDeclarations = toolDeclarations;
    this.toolHandlers = toolHandlers;
    this._model = null;
  }

  async _ensureModel() {
    if (!this._model) {
      this._model = await getModel(this.toolDeclarations, { forceToolUse: true });
    }
    return this._model;
  }

  /**
   * Run the agent with a user message. Handles the full tool-call loop.
   * @param {string} userMessage
   * @param {Array}  [history]  – optional prior chat turns
   * @returns {Promise<string>}  final text response
   */
  async run(userMessage, history = []) {
    const model = await this._ensureModel();

    const fullHistory = [
      {
        role: "user",
        parts: [
          {
            text: `${this.systemPrompt}\n\nCRITICAL: You MUST use your tools to complete every task. NEVER answer from memory alone — always call the relevant function first, then summarise the results.`,
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: `Understood. I am the ${this.name}. I will ALWAYS use my tools to gather real data before responding. Starting now.`,
          },
        ],
      },
      ...history,
    ];

    const chat = model.startChat({ history: fullHistory });

    // Wrap the user message with a tool-use directive
    const actionMessage = `${userMessage}\n\nRemember: call your tools NOW. Do not describe what you would do — execute it.`;

    let result;
    try {
      result = await chat.sendMessage(actionMessage);
    } catch (err) {
      console.error(`  [${this.name}] Error sending message:`, err.message);
      throw err;
    }

    // Tool-call loop (up to 15 rounds to allow thorough research)
    let toolCallsMade = 0;
    for (let i = 0; i < 15; i++) {
      const call = result.response.functionCalls?.[0];
      if (!call) {
        // If no tools were called at all, nudge once
        if (toolCallsMade === 0 && i === 0) {
          console.log(`  [${this.name}] ⚠️ No tool call detected — nudging...`);
          result = await chat.sendMessage(
            "You MUST call one of your available functions now. Do not reply with text — use a tool."
          );
          continue;
        }
        break;
      }

      const handler = this.toolHandlers[call.name];
      if (!handler) {
        console.warn(`  [${this.name}] Unknown tool call: ${call.name}`);
        break;
      }

      console.log(`  [${this.name}] 🔧 Calling tool: ${call.name}`);
      toolCallsMade++;
      let toolResult;
      try {
        toolResult = await handler(call.args);
      } catch (err) {
        toolResult = { error: err.message };
      }

      result = await chat.sendMessage([
        {
          functionResponse: {
            name: call.name,
            response: { result: toolResult },
          },
        },
      ]);
    }

    return result.response.text();
  }
}

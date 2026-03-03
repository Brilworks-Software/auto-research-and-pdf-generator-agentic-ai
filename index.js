/**
 * Multi-Agent Research System — Entry Point
 *
 * Architecture:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                    🧠 MANAGER AGENT                         │
 *   │         Orchestrates all specialist agents                  │
 *   │                                                             │
 *   │   ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐  │
 *   │   │ 🔍 Web   │ │ 📄 Doc   │ │ 📚 Research│ │ 📊 Data    │  │
 *   │   │  Search  │ │  Reader  │ │  Papers   │ │ Collector  │  │
 *   │   └──────────┘ └──────────┘ └───────────┘ └────────────┘  │
 *   │                                                             │
 *   │                   ┌──────────────┐                          │
 *   │                   │ 📝 Report    │                          │
 *   │                   │  Generator   │                          │
 *   │                   └──────────────┘                          │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   Interactive mode:  node index.js
 *   Single query:      node index.js "your research question here"
 */

import readline from "readline";
import { runManager } from "./agents/manager.js";

// ── Banner ────────────────────────────────────────────────────────────────────
function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🧠 Multi-Agent Research System                     ║
║                                                              ║
║   Agents:                                                    ║
║     🔍 Web Search    — Internet search & page fetching       ║
║     📄 Doc Reader    — PDF, HTML & document parsing          ║
║     📚 Research      — arXiv & Semantic Scholar papers       ║
║     📊 Data Collector— Knowledge base management             ║
║     📝 Report Gen    — Structured report creation            ║
║                                                              ║
║   Managed by: 🧠 Manager Agent (Orchestrator)                ║
║                                                              ║
║   Type your research query, or "exit" to quit.               ║
╚══════════════════════════════════════════════════════════════╝
`);
}

// ── Single-query mode ─────────────────────────────────────────────────────────
const queryArg = process.argv.slice(2).join(" ").trim();

if (queryArg) {
  console.log(`\n🔬 Running single query: "${queryArg}"\n`);
  try {
    const report = await runManager(queryArg);
    console.log("\n" + "─".repeat(60));
    console.log("📄 FINAL REPORT");
    console.log("─".repeat(60) + "\n");
    console.log(report);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
  process.exit(0);
}

// ── Interactive mode ──────────────────────────────────────────────────────────
printBanner();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "\n🔬 Research Query > ",
});

rl.prompt();

rl.on("line", async (input) => {
  const query = input.trim();

  if (!query) {
    rl.prompt();
    return;
  }

  if (query.toLowerCase() === "exit" || query.toLowerCase() === "quit") {
    console.log("\n👋 Goodbye!\n");
    rl.close();
    process.exit(0);
  }

  try {
    const report = await runManager(query);
    console.log("\n" + "─".repeat(60));
    console.log("📄 FINAL REPORT");
    console.log("─".repeat(60) + "\n");
    console.log(report);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }

  rl.prompt();
});

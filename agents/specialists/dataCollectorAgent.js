/**
 * Data Collector Agent (Code-Driven) — Enhanced for large-scale data
 *
 * Parses research text into structured entries and stores them
 * in the knowledge base using code-level tool calls.
 * Handles larger volumes of data from multiple research sources.
 */
import { askLLM } from "../config.js";
import {
  storeData,
  deduplicateData,
  getDataStats,
} from "../tools/dataTools.js";

export class DataCollectorAgent {
  constructor() {
    this.name = "Data Collector Agent";
  }

  async run(task) {
    console.log(`  [${this.name}] Parsing & storing findings from multiple sources...`);

    // Step 1: Use LLM to parse the raw text into structured entries
    let entries;
    try {
      const parseResult = await askLLM(
        `Parse the following multi-source research findings into structured data entries for a knowledge base.

Return ONLY a JSON array (no markdown fences) where each element has:
- "title": short descriptive title (5-12 words)
- "content": detailed key information (3-5 sentences each — be thorough, include facts, statistics, dates, names)
- "source": URL, paper reference, "Wikipedia", or book reference
- "tags": array of category tags from these options: "web", "academic", "wikipedia", "books", "documentation", "definition", "application", "statistics", "history", "technology", "methodology", "future", "comparison", "example", "controversy"

Create 15-25 entries covering ALL major findings from ALL sources.
Each entry should be substantive — not just a one-liner.
Capture different types of information: definitions, facts, statistics, examples, opinions, research findings.

Data to parse:
${task.slice(0, 25000)}`
      );

      const cleaned = parseResult.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      entries = JSON.parse(cleaned);
    } catch (err) {
      console.warn(`  [${this.name}] LLM parsing failed, trying chunked approach...`);
      // Fallback: try to store the raw content in logical chunks
      entries = this._chunkFallback(task);
    }

    // Step 2: Store each entry
    let stored = 0;
    for (const entry of entries) {
      try {
        await storeData({
          title: entry.title || "Untitled Finding",
          content: entry.content || "",
          source: entry.source || "unknown",
          tags: Array.isArray(entry.tags) ? entry.tags : ["general"],
        });
        stored++;
      } catch (err) {
        console.warn(`  [${this.name}] Failed to store "${entry.title}":`, err.message);
      }
    }

    // Step 3: Deduplicate
    const dedup = await deduplicateData();
    console.log(`  [${this.name}] Stored ${stored} entries, removed ${dedup.removed} duplicates`);

    // Step 4: Return stats
    const stats = await getDataStats();
    return `Stored ${stored} entries (${dedup.removed} duplicates removed). ` +
      `Knowledge base now has ${stats.totalEntries} entries across tags: ${Object.keys(stats.tags).join(", ")}.`;
  }

  _chunkFallback(task) {
    // Split by source section headers and create entries
    const sections = task.split(/===\s*(.+?)\s*===/);
    const entries = [];
    for (let i = 1; i < sections.length; i += 2) {
      const sectionName = sections[i] || "General";
      const content = (sections[i + 1] || "").trim();
      if (content.length > 50) {
        // Split long content into ~1000-char chunks
        const chunks = content.match(/[\s\S]{1,1500}/g) || [content];
        chunks.forEach((chunk, idx) => {
          entries.push({
            title: `${sectionName} - Part ${idx + 1}`,
            content: chunk.trim(),
            source: sectionName.toLowerCase().includes("web") ? "web search" :
                    sectionName.toLowerCase().includes("academic") ? "academic research" :
                    sectionName.toLowerCase().includes("wiki") ? "Wikipedia" :
                    sectionName.toLowerCase().includes("book") ? "books" : "research",
            tags: [sectionName.toLowerCase().includes("web") ? "web" :
                   sectionName.toLowerCase().includes("academic") ? "academic" :
                   sectionName.toLowerCase().includes("wiki") ? "wikipedia" :
                   sectionName.toLowerCase().includes("book") ? "books" : "general"],
          });
        });
      }
    }
    return entries.length > 0 ? entries : [{
      title: "Research Findings",
      content: task.slice(0, 5000),
      source: "multi-agent research",
      tags: ["research"],
    }];
  }
}

export const dataCollectorAgent = new DataCollectorAgent();

/**
 * Web Search Agent (Code-Driven) — Enhanced for deep research
 *
 * Calls web search tools directly in code, then uses LLM to
 * analyse and summarise the raw results. Fetches more pages
 * and extracts more content for thorough research.
 */
import { askLLM } from "../config.js";
import { webSearch, fetchWebPage } from "../tools/webSearch.js";

export class WebSearchAgent {
  constructor() {
    this.name = "Web Search Agent";
  }

  async run(task) {
    console.log(`  [${this.name}] Starting deep web research...`);

    // Step 1: Extract 4-5 diverse search queries
    const queries = await this._extractQueries(task);
    console.log(`  [${this.name}] Queries (${queries.length}): ${queries.join(" | ")}`);

    // Step 2: Run web searches for all queries
    const allResults = [];
    for (const query of queries) {
      try {
        const results = await webSearch({ query, maxResults: 8 });
        allResults.push(...results);
      } catch (err) {
        console.warn(`  [${this.name}] Search failed for "${query}":`, err.message);
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    const uniqueResults = allResults.filter((r) => {
      if (!r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
    console.log(`  [${this.name}] Got ${uniqueResults.length} unique search results`);

    // Step 3: Fetch top 6 pages for full content (more depth)
    const pagesToFetch = uniqueResults.filter((r) => r.url).slice(0, 6);
    const pageContents = [];
    const fetchPromises = pagesToFetch.map(async (page) => {
      try {
        const content = await fetchWebPage({ url: page.url });
        if (content.content) {
          return {
            title: page.title,
            url: page.url,
            content: content.content.slice(0, 5000),
          };
        }
      } catch (err) {
        console.warn(`  [${this.name}] Fetch failed for ${page.url}:`, err.message);
      }
      return null;
    });
    const fetched = await Promise.all(fetchPromises);
    pageContents.push(...fetched.filter(Boolean));
    console.log(`  [${this.name}] Fetched ${pageContents.length} full pages`);

    // Step 4: LLM produces detailed analysis
    const rawData = JSON.stringify({ searchResults: uniqueResults, fullPages: pageContents }, null, 2);
    const summary = await askLLM(
      `You are an expert web research analyst. Produce a thorough, detailed research summary from the following web search data.

Task: ${task}

Raw data:
${rawData.slice(0, 20000)}

Instructions:
- Organise findings by subtopic with clear sub-headings
- Include ALL facts, statistics, definitions, dates, and numerical data found
- Explain key concepts in depth with examples
- Cite every source with [Title](URL)
- Cover historical background, current state, and future outlook
- Include technical details, methodologies, and expert opinions
- Note any contradictions or debates between sources
- Be extremely comprehensive and detailed (700+ words)
- Only use data provided above — do NOT fabricate information`
    );

    return summary;
  }

  async _extractQueries(task) {
    try {
      const text = await askLLM(
        `Extract 4-5 diverse and specific web search queries from this research task. Include:
- A general overview query
- A technical/detailed query
- A "latest developments" or "recent news" query
- A "applications" or "use cases" query
- A "history" or "background" query

Return ONLY a JSON array of strings, no markdown fencing.
Task: ${task}`
      );
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const arr = JSON.parse(cleaned);
      if (Array.isArray(arr) && arr.length) return arr.slice(0, 5);
    } catch { /* fallback */ }
    return [
      task.split("\n")[0].slice(0, 100),
      `${task.split("\n")[0].slice(0, 60)} overview`,
      `${task.split("\n")[0].slice(0, 60)} latest developments`,
    ];
  }
}

export const webSearchAgent = new WebSearchAgent();

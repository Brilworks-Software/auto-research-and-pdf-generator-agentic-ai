/**
 * Research Paper Agent (Code-Driven) — Enhanced for deep academic research
 *
 * Searches arXiv + Semantic Scholar + CrossRef directly in code,
 * then uses LLM to analyse and summarise the papers in depth.
 */
import { askLLM } from "../config.js";
import {
  searchArxiv,
  searchSemanticScholar,
  getPaperDetails,
  resolveDOI,
} from "../tools/researchTools.js";

export class ResearchAgent {
  constructor() {
    this.name = "Research Paper Agent";
  }

  async run(task) {
    console.log(`  [${this.name}] Starting deep academic research...`);

    // Step 1: Extract 3-4 diverse academic queries
    const queries = await this._extractQueries(task);
    console.log(`  [${this.name}] Queries (${queries.length}): ${queries.join(" | ")}`);

    // Step 2: Search arXiv, Semantic Scholar for each query (more results)
    const allPapers = [];
    for (const q of queries) {
      // arXiv
      try {
        const arxiv = await searchArxiv({ query: q, maxResults: 10 });
        if (arxiv.papers?.length) {
          console.log(`  [${this.name}] arXiv: ${arxiv.papers.length} papers for "${q}"`);
          allPapers.push(...arxiv.papers.map((p) => ({ ...p, source: "arXiv" })));
        }
      } catch (err) {
        console.warn(`  [${this.name}] arXiv failed:`, err.message);
      }

      // Semantic Scholar
      try {
        const ss = await searchSemanticScholar({ query: q, maxResults: 10 });
        if (ss.papers?.length) {
          console.log(`  [${this.name}] Semantic Scholar: ${ss.papers.length} papers for "${q}"`);
          allPapers.push(...ss.papers.map((p) => ({ ...p, source: "Semantic Scholar" })));
        }
      } catch (err) {
        console.warn(`  [${this.name}] Semantic Scholar failed:`, err.message);
      }
    }

    // Deduplicate by title similarity
    const seen = new Set();
    const uniquePapers = allPapers.filter((p) => {
      const key = (p.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`  [${this.name}] Total unique papers found: ${uniquePapers.length}`);

    // Step 3: Get detailed info for top 5 most relevant papers
    const topPapers = uniquePapers.slice(0, 5);
    const details = [];
    for (const p of topPapers) {
      const id = p.doi ? `DOI:${p.doi}` : p.arxivId || p.paperId || p.title;
      try {
        const d = await getPaperDetails({ paperId: id });
        if (d && !d.error) {
          details.push(d);
          console.log(`  [${this.name}] Got details for: "${(d.title || p.title || "unknown").slice(0, 60)}"`);
        }
      } catch { /* skip */ }
    }

    // Step 4: Try to resolve DOIs for papers that have them
    const doiPapers = uniquePapers.filter((p) => p.doi).slice(0, 3);
    const doiDetails = [];
    for (const p of doiPapers) {
      try {
        const d = await resolveDOI({ doi: p.doi });
        if (d && !d.error) doiDetails.push(d);
      } catch { /* skip */ }
    }

    // Step 5: LLM produces comprehensive academic analysis
    const rawData = JSON.stringify(
      { papers: uniquePapers, detailedPapers: details, doiResolved: doiDetails },
      null,
      2
    );
    const summary = await askLLM(
      `You are a senior academic research analyst. Produce a comprehensive scholarly analysis of these research papers.

Task: ${task}

Paper data (${uniquePapers.length} papers, ${details.length} with full details):
${rawData.slice(0, 22000)}

Provide a THOROUGH analysis (800+ words) covering:

### Paper Overview
- List ALL papers found, sorted by relevance and citation count
- For each paper: title, authors, year, journal/venue, citation count

### Key Research Findings
- Summarise the main findings from the top papers in detail
- Quote specific results, metrics, and conclusions
- Explain methodologies used

### Research Landscape
- What are the dominant research themes?
- How has the field evolved over time?
- What are the competing approaches or theories?

### Research Gaps & Open Questions
- What questions remain unanswered?
- What are the limitations of current research?
- Where is more work needed?

### Cross-Paper Synthesis
- What do the papers agree on?
- Where are there contradictions or debates?
- What emerging consensus can be identified?

Use proper academic citations: [Author et al., Year]
Include DOIs and paper IDs where available.
Be thorough, analytical, and evidence-based.`
    );

    return summary;
  }

  async _extractQueries(task) {
    try {
      const text = await askLLM(
        `Extract 3-4 diverse academic search queries for this research task. Include:
- A broad survey/review query
- A specific technical query
- A recent developments query (last 2-3 years focus)
- An applications or methodology query

Return ONLY a JSON array of strings, no markdown fencing.
Task: ${task}`
      );
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const arr = JSON.parse(cleaned);
      if (Array.isArray(arr) && arr.length) return arr.slice(0, 4);
    } catch { /* fallback */ }
    return [
      task.split("\n")[0].slice(0, 80),
      `${task.split("\n")[0].slice(0, 60)} survey review`,
    ];
  }
}

export const researchAgent = new ResearchAgent();

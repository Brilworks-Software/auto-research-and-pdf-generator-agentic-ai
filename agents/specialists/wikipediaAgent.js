/**
 * Wikipedia Agent (Code-Driven)
 *
 * Deep Wikipedia research — fetches full articles, related topics,
 * and section-level content, then uses LLM for analysis.
 */
import { askLLM } from "../config.js";
import {
  wikiSummary,
  wikiFullArticle,
  wikiSearch,
  wikiRelatedTopics,
} from "../tools/wikipedia.js";

export class WikipediaAgent {
  constructor() {
    this.name = "Wikipedia Agent";
  }

  async run(task) {
    console.log(`  [${this.name}] Starting deep Wikipedia research...`);

    // Step 1: Extract main topic and sub-topics to search
    const topics = await this._extractTopics(task);
    console.log(`  [${this.name}] Topics: ${topics.join(" | ")}`);

    const allData = {
      summaries: [],
      fullArticles: [],
      relatedTopics: [],
      searchResults: [],
    };

    // Step 2: Search Wikipedia for each topic
    for (const topic of topics.slice(0, 3)) {
      try {
        const search = await wikiSearch({ query: topic, limit: 5 });
        if (search.results?.length) {
          allData.searchResults.push(...search.results);
        }
      } catch (err) {
        console.warn(`  [${this.name}] Search failed for "${topic}":`, err.message);
      }
    }
    console.log(`  [${this.name}] Found ${allData.searchResults.length} Wikipedia articles`);

    // Step 3: Get summaries of the top results
    const uniqueTitles = [...new Set(allData.searchResults.map((r) => r.title))].slice(0, 5);
    for (const title of uniqueTitles) {
      try {
        const summary = await wikiSummary({ topic: title });
        if (summary.extract) {
          allData.summaries.push(summary);
        }
      } catch { /* skip */ }
    }
    console.log(`  [${this.name}] Got ${allData.summaries.length} summaries`);

    // Step 4: Get FULL article content for the most relevant article (main topic)
    const mainTopic = uniqueTitles[0] || topics[0];
    try {
      const fullArticle = await wikiFullArticle({ topic: mainTopic });
      if (fullArticle.content) {
        allData.fullArticles.push(fullArticle);
        console.log(
          `  [${this.name}] Full article: "${fullArticle.title}" (${fullArticle.contentLength} chars, ${fullArticle.sections?.length} sections)`
        );

        // Also get related topics from the main article
        const related = await wikiRelatedTopics({ topic: mainTopic, limit: 10 });
        allData.relatedTopics = related.relatedTopics || [];
      }
    } catch (err) {
      console.warn(`  [${this.name}] Full article fetch failed:`, err.message);
    }

    // Step 5: Get a second full article if there's a distinct related topic
    if (uniqueTitles.length > 1) {
      try {
        const secondArticle = await wikiFullArticle({ topic: uniqueTitles[1] });
        if (secondArticle.content && secondArticle.content.length > 500) {
          allData.fullArticles.push(secondArticle);
          console.log(`  [${this.name}] Second article: "${secondArticle.title}"`);
        }
      } catch { /* skip */ }
    }

    // Step 6: LLM analysis
    const rawData = JSON.stringify(allData, null, 2);
    const summary = await askLLM(
      `You are a Wikipedia research expert. Analyse the following Wikipedia data and produce a thorough, encyclopedic summary.

Task: ${task}

Wikipedia Data:
${rawData.slice(0, 18000)}

Instructions:
- Write a comprehensive overview (600+ words)
- Organise by topic/subtopic with clear headings
- Include definitions, history, key concepts, and details
- Cite Wikipedia articles: [Wikipedia: Article Title]
- Include relevant dates, names, statistics, and facts
- Note the article sections/structure for thoroughness
- List related topics that could provide more depth
- Be factual and encyclopedic in tone`
    );

    return summary;
  }

  async _extractTopics(task) {
    try {
      const text = await askLLM(
        `Extract 2-3 Wikipedia article topics from this research task. Return ONLY a JSON array of strings (article-title style, e.g. "Quantum computing", "Qubit"), no markdown.\nTask: ${task}`
      );
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const arr = JSON.parse(cleaned);
      if (Array.isArray(arr) && arr.length) return arr.slice(0, 3);
    } catch { /* fallback */ }
    // Fallback: use the first line as search topic
    const firstLine = task.split("\n")[0].replace(/^.*?["']([^"']+)["'].*$/, "$1").slice(0, 60);
    return [firstLine];
  }
}

export const wikipediaAgent = new WikipediaAgent();

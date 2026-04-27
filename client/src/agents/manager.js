/**
 * Manager Agent (browser-compatible orchestrator)
 *
 * Orchestrates the full research pipeline:
 *  1. Planning — LLM creates a comprehensive research plan
 *  2. Multi-source research — 4 agents run in parallel
 *  3. Data collection — stores & deduplicates findings
 *  4. Report generation — produces the final report
 */
import { getModel, askLLM } from "./config.js";
import { webSearchAgent } from "./specialists/webSearchAgent.js";
import { docReaderAgent } from "./specialists/docReaderAgent.js";
import { researchAgent } from "./specialists/researchAgent.js";
import { wikipediaAgent } from "./specialists/wikipediaAgent.js";
import { booksAgent } from "./specialists/booksAgent.js";
import { dataCollectorAgent } from "./specialists/dataCollectorAgent.js";
import { reportAgent } from "./specialists/reportAgent.js";
import { resetKnowledgeBase } from "./tools/dataTools.js";

async function safeRun(agent, task) {
  try {
    console.log(`\n🔀 Manager → [${agent.name}]`);
    console.log(`   Task: ${task.slice(0, 150)}${task.length > 150 ? "..." : ""}\n`);
    const result = await agent.run(task);
    console.log(`✅ [${agent.name}] done (${result.length} chars)\n`);
    return result;
  } catch (err) {
    console.error(`❌ [${agent.name}] failed: ${err.message}\n`);
    return `[Error from ${agent.name}: ${err.message}]`;
  }
}

async function createResearchPlan(userQuery) {
  console.log("📝 Creating comprehensive research plan...\n");
  const model = await getModel();
  const result = await model.generateContent(
    `You are an expert research planner. Given this user query, create a comprehensive research plan.

Output a JSON object with:
- "webQueries": array of 4-5 specific web search queries
- "academicQueries": array of 3-4 academic search queries
- "wikipediaTopics": array of 3-4 Wikipedia article titles
- "bookQueries": array of 2-3 book/textbook search queries
- "docQueries": array of 2-3 documentation/tutorial search queries
- "subtopics": array of 6-8 key subtopics that should be covered in the final report
- "keyQuestions": array of 4-5 key questions the report should answer

User query: "${userQuery}"

Respond ONLY with valid JSON, no markdown fencing.`
  );

  let planText = result.response.text().trim();
  planText = planText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(planText);
  } catch {
    return {
      webQueries: [userQuery, `${userQuery} overview`, `${userQuery} latest developments`, `${userQuery} applications`, `${userQuery} vs alternatives`],
      academicQueries: [`${userQuery} survey review`, `${userQuery} research`, `${userQuery} methodology`],
      wikipediaTopics: [userQuery, `${userQuery} history`],
      bookQueries: [`${userQuery} textbook`, `${userQuery} guide`],
      docQueries: [`${userQuery} documentation`, `${userQuery} tutorial`],
      subtopics: ["overview", "history", "key concepts", "applications", "recent developments", "challenges", "future directions"],
      keyQuestions: [`What is ${userQuery}?`, `How does ${userQuery} work?`, `What are the applications?`, `What are the challenges?`],
    };
  }
}

export async function runManager(userQuery, onSourceUpdate = null) {
  console.log("\n" + "═".repeat(60));
  console.log("🧠 MANAGER AGENT — Deep Research Pipeline");
  console.log("═".repeat(60));
  console.log(`📋 Query: "${userQuery}"\n`);

  // Reset knowledge base for this session
  resetKnowledgeBase();

  // ── Phase 1: Planning ───────────────────────────────────────────────────────
  console.log("📌 PHASE 1: Research Planning");
  const plan = await createResearchPlan(userQuery);
  console.log("  Web queries:", plan.webQueries);
  console.log("  Academic queries:", plan.academicQueries);
  console.log("  Wikipedia topics:", plan.wikipediaTopics);

  // ── Phase 2: Multi-Source Research (4 agents in parallel) ───────────────────
  console.log("\n📌 PHASE 2: Multi-Source Research (4 agents in parallel)");

  const webTask = `Search the web for comprehensive information about: "${userQuery}"

Use these specific search queries:
${(plan.webQueries || []).map((q, i) => `${i + 1}. "${q}"`).join("\n")}

For each query:
1. Run webSearch to get results
2. Fetch the most promising pages for full content
3. Extract ALL relevant facts, statistics, dates, and details

Cover these subtopics thoroughly: ${(plan.subtopics || []).join(", ")}
Answer these key questions: ${(plan.keyQuestions || []).join("; ")}

Return a detailed, comprehensive summary of ALL findings with source URLs.`;

  const researchTask = `Search for academic research papers about: "${userQuery}"

Use these search queries:
${(plan.academicQueries || []).map((q, i) => `${i + 1}. "${q}"`).join("\n")}

For each query:
1. Search BOTH arXiv and Semantic Scholar with maxResults=10 each
2. Get details for the top 5 most relevant/cited papers

Return: paper titles, authors, year, venue, citation count, methodology, key findings, and full abstracts.`;

  const wikiTask = `Research these Wikipedia topics in depth: "${userQuery}"

Topics to look up:
${(plan.wikipediaTopics || [userQuery]).map((t, i) => `${i + 1}. "${t}"`).join("\n")}

For each topic:
1. Get the full Wikipedia article
2. Get section-by-section analysis
3. Find related topics

Subtopics of interest: ${(plan.subtopics || []).join(", ")}

Return a comprehensive analysis with all facts, dates, statistics, and explanations from Wikipedia.`;

  const booksTask = `Search for books, textbooks, and documentation about: "${userQuery}"

Book search queries:
${(plan.bookQueries || []).map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Documentation queries:
${(plan.docQueries || []).map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Return: book titles, authors, publishers, descriptions, and key documentation content.`;

  const [webResults, researchResults, wikiResults, booksResults] = await Promise.all([
    (async () => {
      if (onSourceUpdate) onSourceUpdate("source_active", { source: "web" });
      try {
        const result = await safeRun(webSearchAgent, webTask);
        if (onSourceUpdate) onSourceUpdate("source_complete", { source: "web" });
        return result;
      } catch (e) {
        if (onSourceUpdate) onSourceUpdate("source_complete", { source: "web" });
        throw e;
      }
    })(),
    (async () => {
      if (onSourceUpdate) onSourceUpdate("source_active", { source: "research" });
      try {
        const result = await safeRun(researchAgent, researchTask);
        if (onSourceUpdate) onSourceUpdate("source_complete", { source: "research" });
        return result;
      } catch (e) {
        if (onSourceUpdate) onSourceUpdate("source_complete", { source: "research" });
        throw e;
      }
    })(),
    (async () => {
      if (onSourceUpdate) onSourceUpdate("source_active", { source: "wikipedia" });
      try {
        const result = await safeRun(wikipediaAgent, wikiTask);
        if (onSourceUpdate) onSourceUpdate("source_complete", { source: "wikipedia" });
        return result;
      } catch (e) {
        if (onSourceUpdate) onSourceUpdate("source_complete", { source: "wikipedia" });
        throw e;
      }
    })(),
    (async () => {
      if (onSourceUpdate) onSourceUpdate("source_active", { source: "books" });
      try {
        const result = await safeRun(booksAgent, booksTask);
        if (onSourceUpdate) onSourceUpdate("source_complete", { source: "books" });
        return result;
      } catch (e) {
        if (onSourceUpdate) onSourceUpdate("source_complete", { source: "books" });
        throw e;
      }
    })(),
  ]);

  // ── Phase 3: Data Collection ────────────────────────────────────────────────
  console.log("📌 PHASE 3: Data Collection & Organisation");

  const storeTask = `Store ALL the following research findings in the knowledge base.

=== WEB SEARCH FINDINGS ===
${webResults}

=== ACADEMIC RESEARCH FINDINGS ===
${researchResults}

=== WIKIPEDIA FINDINGS ===
${wikiResults}

=== BOOKS & DOCUMENTATION FINDINGS ===
${booksResults}

Instructions:
1. Create 15-25 detailed entries with clear titles, detailed content, source URLs, and appropriate tags
2. After storing everything, deduplicate
3. Return the stats`;

  if (onSourceUpdate) onSourceUpdate("source_active", { source: "datacollector" });
  try {
    await safeRun(dataCollectorAgent, storeTask);
    if (onSourceUpdate) onSourceUpdate("source_complete", { source: "datacollector" });
  } catch (e) {
    if (onSourceUpdate) onSourceUpdate("source_complete", { source: "datacollector" });
  }

  // ── Phase 4: Report Generation ─────────────────────────────────────────────
  console.log("📌 PHASE 4: Comprehensive Report Generation");

  const reportTask = `Generate a comprehensive, in-depth research report on: "${userQuery}"

Retrieve ALL data from the knowledge base and produce a DETAILED report (1500+ words) in Markdown.

Key subtopics to cover: ${(plan.subtopics || []).join(", ")}
Key questions to answer: ${(plan.keyQuestions || []).join("; ")}

Include all required sections: Executive Summary, Introduction, Core Concepts, Web Research Findings, Academic Literature Review, Books & References, Applications, Recent Developments, Challenges, Future Directions, Conclusions, and full References list.

Cite ALL sources inline. Target 1500-2500 words.`;

  if (onSourceUpdate) onSourceUpdate("source_active", { source: "reportAgent" });
  try {
    const report = await safeRun(reportAgent, reportTask);
    if (onSourceUpdate) onSourceUpdate("source_complete", { source: "reportAgent" });

    console.log("\n🧠 MANAGER AGENT — Research pipeline complete\n");
    return report;
  } catch (e) {
    if (onSourceUpdate) onSourceUpdate("source_complete", { source: "reportAgent" });
    throw e;
  }
}

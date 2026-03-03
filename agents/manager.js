/**
 * Manager Agent (Orchestrator) — Enhanced Deep Research Pipeline
 *
 * A code-level orchestrator that:
 *  1. Uses LLM to analyse the user's query and create a comprehensive research plan
 *  2. Programmatically delegates to 6 specialist agents across 3 research phases
 *  3. Collects all results into the data collector
 *  4. Uses the report generator to produce the final detailed output
 *
 * Research sources: Web search, Wikipedia, Research papers, Books & Documentation
 */
import { getModel } from "./config.js";
import { webSearchAgent } from "./specialists/webSearchAgent.js";
import { docReaderAgent } from "./specialists/docReaderAgent.js";
import { researchAgent } from "./specialists/researchAgent.js";
import { wikipediaAgent } from "./specialists/wikipediaAgent.js";
import { booksAgent } from "./specialists/booksAgent.js";
import { dataCollectorAgent } from "./specialists/dataCollectorAgent.js";
import { reportAgent } from "./specialists/reportAgent.js";

// ── Step helpers ──────────────────────────────────────────────────────────────

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

// ── Planning step — uses LLM to generate comprehensive sub-queries ───────────

async function createResearchPlan(userQuery) {
  console.log("📝 Creating comprehensive research plan...\n");
  const model = await getModel();
  const result = await model.generateContent(
    `You are an expert research planner. Given this user query, create a comprehensive research plan.

Output a JSON object with:
- "webQueries": array of 4-5 specific web search queries (overview, technical, recent news, applications, comparisons)
- "academicQueries": array of 3-4 academic search queries (survey, specific topic, methodology, applications)
- "wikipediaTopics": array of 3-4 Wikipedia article titles to look up (main topic + related concepts)
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

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runManager(userQuery, onSourceUpdate = null) {
  console.log("\n" + "═".repeat(60));
  console.log("🧠 MANAGER AGENT — Deep Research Pipeline");
  console.log("═".repeat(60));
  console.log(`📋 Query: "${userQuery}"\n`);

  // ── Phase 1: Planning ───────────────────────────────────────────────────────
  console.log("━".repeat(40));
  console.log("📌 PHASE 1: Research Planning");
  console.log("━".repeat(40));

  const plan = await createResearchPlan(userQuery);
  console.log("  Web queries:", plan.webQueries);
  console.log("  Academic queries:", plan.academicQueries);
  console.log("  Wikipedia topics:", plan.wikipediaTopics);
  console.log("  Book queries:", plan.bookQueries);
  console.log("  Doc queries:", plan.docQueries);
  console.log("  Subtopics:", plan.subtopics);
  console.log("  Key questions:", plan.keyQuestions);

  // ── Phase 2: Multi-Source Research (4 agents in parallel) ───────────────────
  console.log("\n" + "━".repeat(40));
  console.log("📌 PHASE 2: Multi-Source Research (4 agents in parallel)");
  console.log("━".repeat(40));

  // 2a — Web Search Agent
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

  // 2b — Research Paper Agent
  const researchTask = `Search for academic research papers about: "${userQuery}"

Use these search queries:
${(plan.academicQueries || []).map((q, i) => `${i + 1}. "${q}"`).join("\n")}

For each query:
1. Search BOTH arXiv and Semantic Scholar with maxResults=10 each
2. Get details for the top 5 most relevant/cited papers
3. Try to resolve DOIs for full metadata

Return: paper titles, authors, year, venue, citation count, methodology, key findings, and full abstracts.`;

  // 2c — Wikipedia Agent
  const wikiTask = `Research these Wikipedia topics in depth: "${userQuery}"

Topics to look up:
${(plan.wikipediaTopics || [userQuery]).map((t, i) => `${i + 1}. "${t}"`).join("\n")}

For each topic:
1. Get the full Wikipedia article
2. Get section-by-section analysis
3. Find related topics

Subtopics of interest: ${(plan.subtopics || []).join(", ")}

Return a comprehensive analysis with all facts, dates, statistics, and explanations from Wikipedia.`;

  // 2d — Books & Documentation Agent
  const booksTask = `Search for books, textbooks, and documentation about: "${userQuery}"

Book search queries:
${(plan.bookQueries || []).map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Documentation queries:
${(plan.docQueries || []).map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Find:
1. Authoritative textbooks and books on the subject
2. Official documentation and tutorials
3. Key concepts explained in reference materials

Return: book titles, authors, publishers, descriptions, and key documentation content.`;

  // Run all 4 research agents in parallel with source tracking
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
  console.log("━".repeat(40));
  console.log("📌 PHASE 3: Data Collection & Organisation");
  console.log("━".repeat(40));

  const storeTask = `Store ALL the following research findings in the knowledge base. Create SEPARATE entries for each finding with appropriate tags.

=== WEB SEARCH FINDINGS ===
${webResults}

=== ACADEMIC RESEARCH FINDINGS ===
${researchResults}

=== WIKIPEDIA FINDINGS ===
${wikiResults}

=== BOOKS & DOCUMENTATION FINDINGS ===
${booksResults}

Instructions:
1. Create 15-25 detailed entries. For each entry provide:
   - A clear title
   - Detailed content (key information, not just summaries)
   - The source (URL, paper reference, Wikipedia, or book)
   - Tags like: "web", "academic", "wikipedia", "books", "documentation", "definition", "application", "statistics", "history", "technology", "methodology", "future"
2. After storing everything, deduplicate
3. Return the stats`;

  if (onSourceUpdate) onSourceUpdate("source_active", { source: "datacollector" });
  try {
    await safeRun(dataCollectorAgent, storeTask);
    if (onSourceUpdate) onSourceUpdate("source_complete", { source: "datacollector" });
  } catch (e) {
    if (onSourceUpdate) onSourceUpdate("source_complete", { source: "datacollector" });
    throw e;
  }

  // ── Phase 4: Comprehensive Report Generation ───────────────────────────────
  console.log("━".repeat(40));
  console.log("📌 PHASE 4: Comprehensive Report Generation");
  console.log("━".repeat(40));

  const reportTask = `Generate a comprehensive, in-depth research report on: "${userQuery}"

Retrieve ALL data from the knowledge base and produce a DETAILED report (1500+ words) in Markdown:

# ${userQuery}

## 1. Executive Summary
Concise overview (4-5 sentences) covering the most important takeaways.

## 2. Introduction & Background  
What is ${userQuery}? Full background, historical context, origins, and why it matters. 
Reference Wikipedia and encyclopedic sources here.

## 3. Core Concepts & How It Works
Detailed technical explanation of key concepts, mechanisms, and principles.
Use sub-headings for each major concept.

## 4. Key Findings from Web Research
Detailed findings from web sources, organised by subtopic: ${(plan.subtopics || []).join(", ")}.
Use bullet points, sub-headings, statistics, and examples.

## 5. Academic Research & Literature Review
Comprehensive summary of research papers. For each significant paper:
- Title, Authors, Year, Venue
- Methodology and approach
- Key findings and results
- Citations: [Author et al., Year]

## 6. Books & Reference Materials
Notable books, textbooks, and documentation found on the topic.
Include author, publisher, and key takeaways from each.

## 7. Applications & Real-World Impact
Real-world applications, use cases, industry adoption, and practical implications.
Include specific examples and case studies.

## 8. Current State & Recent Developments
What's happening now? Latest developments, trends, and news.

## 9. Challenges, Debates & Open Questions
Known challenges, controversies, competing theories, and unsolved problems.

## 10. Future Directions & Outlook
Where is this field heading? Predictions, emerging trends, and opportunities.

## 11. Conclusions
Summary of the most important findings and takeaways.

## 12. References
Numbered list of ALL sources used:
- Web sources with URLs
- Academic papers with DOIs/arXiv IDs
- Wikipedia articles
- Books with authors and publishers

Key questions to answer: ${(plan.keyQuestions || []).join("; ")}

Make the report EXTREMELY detailed — aim for 1500-2500 words. 
Use proper Markdown formatting with headers, bullets, bold, tables where appropriate.
Cite sources inline throughout EVERY section.`;

  if (onSourceUpdate) onSourceUpdate("source_active", { source: "reportAgent" });
  try {
    const report = await safeRun(reportAgent, reportTask);
    if (onSourceUpdate) onSourceUpdate("source_complete", { source: "reportAgent" });

    console.log("\n" + "═".repeat(60));
    console.log("🧠 MANAGER AGENT — Deep research pipeline complete");
    console.log("═".repeat(60) + "\n");

    return report;
  } catch (e) {
    if (onSourceUpdate) onSourceUpdate("source_complete", { source: "reportAgent" });
    throw e;
  }
}
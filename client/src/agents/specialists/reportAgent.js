/**
 * Report Generator Agent (browser-compatible, code-driven)
 */
import { askLLM } from "../config.js";
import { retrieveData, getDataStats } from "../tools/dataTools.js";

export class ReportAgent {
  constructor() {
    this.name = "Report Generator Agent";
  }

  async run(task) {
    console.log(`  [${this.name}] Generating comprehensive report...`);

    const allData = await retrieveData({ tag: "" });
    const stats = await getDataStats();

    console.log(`  [${this.name}] Knowledge base: ${stats.totalEntries} entries`);
    console.log(`  [${this.name}] Tags: ${Object.entries(stats.tags).map(([t, c]) => `${t}(${c})`).join(", ")}`);

    const entries = allData.entries || [];
    const kbContent = JSON.stringify(entries, null, 2);

    const report = await askLLM(
      `You are a professional research report writer producing a COMPREHENSIVE, PUBLICATION-QUALITY report.

Task: ${task}

Knowledge Base Data (${stats.totalEntries} total entries):
${kbContent.slice(0, 30000)}

Data Statistics:
${JSON.stringify(stats, null, 2)}

CRITICAL INSTRUCTIONS:
1. Write a MINIMUM of 1500 words — aim for 2000-2500 words
2. Use EVERY piece of data from the knowledge base
3. Cite sources inline throughout EVERY section — not just in references
4. Use proper Markdown: headers (##), sub-headings (###), bullet points, bold, italic, tables
5. Include statistics, numerical data, dates, and specific examples wherever available
6. For academic papers: cite as [Author et al., Year] with full details in references
7. For web sources: cite as [Source Name](URL)
8. For Wikipedia: cite as [Wikipedia: Article Name]
9. For books: cite as [Author, "Book Title", Publisher, Year]

REQUIRED SECTIONS (include ALL of these):

# [Topic Title — A Comprehensive Research Report]

## 1. Executive Summary
4-5 sentences covering the most important takeaways from ALL sources.

## 2. Introduction & Background
Full background, historical origins, context, and significance.

## 3. Core Concepts & Mechanisms
Detailed technical explanation of key concepts.
Use ### sub-headings for each major concept.

## 4. Key Findings from Web Research
Organised by subtopic with ### sub-headings.
Include facts, statistics, expert quotes, and real-world data points.

## 5. Academic Research & Literature Review
For EACH significant paper found: title, authors, year, venue, key findings.

## 6. Books & Reference Materials
Notable textbooks and documentation found.

## 7. Applications & Real-World Impact
Specific use cases, industry adoption, case studies.

## 8. Current State & Recent Developments
Latest news, trends, and developments.

## 9. Challenges & Open Questions
Known limitations, debates, controversies, and unsolved problems.

## 10. Future Directions & Outlook
Predictions, emerging trends, and opportunities.

## 11. Conclusions
Synthesis of all findings — 5-7 key takeaway points.

## 12. References
Numbered list of ALL sources used, categorised by type:
### Web Sources
### Academic Papers
### Wikipedia Articles
### Books & Documentation

Remember: This MUST be 1500+ words, thoroughly cited, and use ALL available data.`
    );

    return report;
  }
}

export const reportAgent = new ReportAgent();

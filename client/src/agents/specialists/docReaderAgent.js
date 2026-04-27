/**
 * Document Reader Agent (browser-compatible, code-driven)
 */
import { askLLM } from "../config.js";
import { readDocument, extractKeyInfo } from "../tools/docReader.js";

export class DocReaderAgent {
  constructor() {
    this.name = "Document Reader Agent";
  }

  async run(task) {
    console.log(`  [${this.name}] Starting document reading...`);

    const urls = this._extractUrls(task);
    if (!urls.length) {
      return `[${this.name}] No URLs found in task. Provide URLs to read.`;
    }

    console.log(`  [${this.name}] Reading ${urls.length} document(s)...`);

    const docs = [];
    for (const url of urls.slice(0, 5)) {
      try {
        const doc = await readDocument({ url });
        docs.push(doc);
        console.log(`  [${this.name}] Read: ${doc.title || url} (${doc.type})`);
      } catch (err) {
        console.warn(`  [${this.name}] Failed to read ${url}:`, err.message);
      }
    }

    if (!docs.length) return `[${this.name}] Could not read any documents.`;

    const rawData = JSON.stringify(docs, null, 2);
    const summary = await askLLM(
      `You are a document analyst. Analyse these documents and provide structured summaries.\n\nTask: ${task}\n\nDocuments:\n${rawData.slice(0, 15000)}\n\nFor each document provide:\n- Title and type\n- Key sections\n- Important facts/quotes/data\n- Metadata (author, date) when available`
    );

    return summary;
  }

  _extractUrls(text) {
    const urlRegex = /https?:\/\/[^\s"'<>]+/g;
    return [...new Set(text.match(urlRegex) || [])];
  }
}

export const docReaderAgent = new DocReaderAgent();

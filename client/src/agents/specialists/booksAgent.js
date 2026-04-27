/**
 * Books & Documentation Agent (browser-compatible, code-driven)
 */
import { askLLM } from "../config.js";
import {
  searchGoogleBooks,
  searchOpenLibrary,
  getOpenLibraryBook,
  searchDocumentation,
} from "../tools/booksAndDocs.js";

export class BooksAgent {
  constructor() {
    this.name = "Books & Docs Agent";
  }

  async run(task) {
    console.log(`  [${this.name}] Searching books & documentation...`);

    const queries = await this._extractQueries(task);
    console.log(`  [${this.name}] Queries: ${queries.join(" | ")}`);

    const allData = {
      googleBooks: [],
      openLibraryBooks: [],
      bookDetails: [],
      documentation: [],
    };

    for (const q of queries.slice(0, 2)) {
      try {
        const result = await searchGoogleBooks({ query: q, maxResults: 6 });
        if (result.books?.length) {
          allData.googleBooks.push(...result.books);
          console.log(`  [${this.name}] Google Books: ${result.books.length} for "${q}"`);
        }
      } catch (err) {
        console.warn(`  [${this.name}] Google Books failed:`, err.message);
      }
    }

    for (const q of queries.slice(0, 2)) {
      try {
        const result = await searchOpenLibrary({ query: q, limit: 5 });
        if (result.books?.length) {
          allData.openLibraryBooks.push(...result.books);
          console.log(`  [${this.name}] Open Library: ${result.books.length} for "${q}"`);
        }
      } catch (err) {
        console.warn(`  [${this.name}] Open Library failed:`, err.message);
      }
    }

    const booksWithKeys = allData.openLibraryBooks.filter((b) => b.openLibraryUrl);
    for (const book of booksWithKeys.slice(0, 2)) {
      try {
        const key = new URL(book.openLibraryUrl).pathname;
        const details = await getOpenLibraryBook({ workKey: key });
        if (details && !details.error) {
          allData.bookDetails.push(details);
        }
      } catch { /* skip */ }
    }

    for (const q of queries.slice(0, 2)) {
      try {
        const docs = await searchDocumentation({ query: q });
        if (docs.results?.length) {
          allData.documentation.push(...docs.results);
          console.log(`  [${this.name}] Documentation: ${docs.results.length} results for "${q}"`);
        }
      } catch (err) {
        console.warn(`  [${this.name}] Doc search failed:`, err.message);
      }
    }

    const totalBooks = allData.googleBooks.length + allData.openLibraryBooks.length;
    console.log(`  [${this.name}] Total: ${totalBooks} books, ${allData.documentation.length} doc results`);

    const rawData = JSON.stringify(allData, null, 2);
    const summary = await askLLM(
      `You are a scholarly research assistant specialising in books and documentation. Analyse the following data.

Task: ${task}

Book & Documentation Data:
${rawData.slice(0, 16000)}

Instructions:
- List the most relevant books found, sorted by relevance
- For each book include: title, authors, year, publisher, description, page count
- Identify seminal/foundational textbooks in the field
- Note any highly-rated or widely-published books
- Summarise relevant documentation found
- Include ISBNs and links where available
- Recommend the top 3-5 books for someone researching this topic
- Be comprehensive (400+ words)`
    );

    return summary;
  }

  async _extractQueries(task) {
    try {
      const text = await askLLM(
        `Extract 2 book/documentation search queries from this task. Return ONLY a JSON array of strings, no markdown.\nTask: ${task}`
      );
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const arr = JSON.parse(cleaned);
      if (Array.isArray(arr) && arr.length) return arr.slice(0, 2);
    } catch { /* fallback */ }
    return [task.split("\n")[0].slice(0, 80)];
  }
}

export const booksAgent = new BooksAgent();

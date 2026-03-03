/**
 * Document Reader Tools
 *
 * Provides capabilities to read and extract content from:
 *  • Web pages (HTML)
 *  • PDF documents (via URL)
 *  • Plain text / Markdown files (via URL)
 *  • JSON / API responses
 */
import * as cheerio from "cheerio";

/**
 * Read and extract text from a document at the given URL.
 * Supports HTML, plain text, and attempts PDF extraction.
 */
export async function readDocument({ url, extractionMode = "auto" }) {
  console.log(`    [readDocument] Reading: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/pdf,text/plain,application/json,*/*",
      },
      signal: AbortSignal.timeout(20000),
    });

    const contentType = res.headers.get("content-type") || "";
    
    // PDF handling
    if (contentType.includes("application/pdf") || url.endsWith(".pdf")) {
      try {
        const buffer = await res.arrayBuffer();
        const pdfParse = (await import("pdf-parse")).default;
        const pdf = await pdfParse(Buffer.from(buffer));
        return {
          url,
          type: "pdf",
          title: pdf.info?.Title || "PDF Document",
          pages: pdf.numpages,
          content: pdf.text.slice(0, 12000),
          contentLength: pdf.text.length,
          metadata: {
            author: pdf.info?.Author || "Unknown",
            subject: pdf.info?.Subject || "",
            keywords: pdf.info?.Keywords || "",
          },
        };
      } catch (pdfErr) {
        return { url, type: "pdf", error: `PDF parsing failed: ${pdfErr.message}` };
      }
    }

    const rawText = await res.text();

    // JSON handling
    if (contentType.includes("application/json") || extractionMode === "json") {
      try {
        const json = JSON.parse(rawText);
        const pretty = JSON.stringify(json, null, 2);
        return {
          url,
          type: "json",
          content: pretty.slice(0, 10000),
          contentLength: pretty.length,
        };
      } catch {
        // fallthrough to text
      }
    }

    // HTML handling
    if (contentType.includes("text/html") || extractionMode === "html") {
      const $ = cheerio.load(rawText);
      $("script, style, nav, footer, header, aside, .ad, .sidebar").remove();

      const title = $("title").text().trim() || $("h1").first().text().trim() || "";

      // Extract structured sections
      const sections = [];
      $("h1, h2, h3, h4, h5, h6").each((_, el) => {
        const heading = $(el).text().trim();
        let content = "";
        let next = $(el).next();
        while (next.length && !next.is("h1, h2, h3, h4, h5, h6")) {
          content += next.text().trim() + "\n";
          next = next.next();
        }
        if (heading) sections.push({ heading, content: content.trim() });
      });

      // Fallback: grab body text
      let bodyText = $("article, main, .content, #content")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (!bodyText) bodyText = $("body").text().replace(/\s+/g, " ").trim();

      return {
        url,
        type: "html",
        title,
        sections: sections.slice(0, 20),
        content: bodyText.slice(0, 10000),
        contentLength: bodyText.length,
      };
    }

    // Plain text / markdown
    return {
      url,
      type: "text",
      content: rawText.slice(0, 10000),
      contentLength: rawText.length,
    };
  } catch (err) {
    return { url, type: "error", error: err.message };
  }
}

/**
 * Summarize a long document by extracting key sections.
 */
export async function extractKeyInfo({ url, focus = "" }) {
  console.log(`    [extractKeyInfo] Extracting from: ${url} | Focus: ${focus}`);
  const doc = await readDocument({ url });

  if (doc.error) return doc;

  return {
    url,
    type: doc.type,
    title: doc.title || "",
    contentPreview: doc.content?.slice(0, 5000) || "",
    sections: doc.sections?.slice(0, 10) || [],
    metadata: doc.metadata || {},
    focusHint: focus,
  };
}

// ── Tool declarations ─────────────────────────────────────────────────────────
export const docReaderToolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "readDocument",
        description:
          "Read a document from a URL. Supports HTML web pages, PDFs, plain text, markdown, and JSON. Extracts and returns the text content.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL of the document to read" },
            extractionMode: {
              type: "string",
              description: "Force extraction mode: auto, html, json, or text (default: auto)",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "extractKeyInfo",
        description:
          "Read a document and extract key information, sections, and metadata. Optionally focus on a specific topic.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL of the document" },
            focus: {
              type: "string",
              description: "Optional focus topic — the extraction will prioritize this area",
            },
          },
          required: ["url"],
        },
      },
    ],
  },
];

export const docReaderToolHandlers = {
  readDocument,
  extractKeyInfo,
};

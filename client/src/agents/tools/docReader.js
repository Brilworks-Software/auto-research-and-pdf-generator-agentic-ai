/**
 * Document Reader Tools (browser-compatible)
 *
 * Reads HTML pages and plain text via fetch.
 * Uses browser DOMParser for HTML parsing (replaces cheerio).
 * PDF reading is not supported in the browser environment.
 */

/**
 * Read and extract text from a document at the given URL.
 * Supports HTML, plain text, and JSON.
 */
export async function readDocument({ url, extractionMode = "auto" }) {
  console.log(`    [readDocument] Reading: ${url}`);
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
    });

    const contentType = res.headers.get("content-type") || "";

    // PDF — not supported in browser without a library
    if (contentType.includes("application/pdf") || url.endsWith(".pdf")) {
      return {
        url,
        type: "pdf",
        error: "PDF reading is not supported in the browser. Try the HTML version of this document.",
      };
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

    // HTML handling using browser DOMParser
    if (contentType.includes("text/html") || extractionMode === "html") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawText, "text/html");

      // Remove noise
      ["script", "style", "nav", "footer", "header", "aside"].forEach((tag) => {
        doc.querySelectorAll(tag).forEach((el) => el.remove());
      });

      const title =
        doc.title?.trim() ||
        doc.querySelector("h1")?.textContent?.trim() ||
        "";

      // Extract structured sections
      const sections = [];
      doc.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
        const headingText = heading.textContent?.trim() || "";
        let content = "";
        let next = heading.nextElementSibling;
        while (next && !["H1","H2","H3","H4","H5","H6"].includes(next.tagName)) {
          content += (next.textContent?.trim() || "") + "\n";
          next = next.nextElementSibling;
        }
        if (headingText) sections.push({ heading: headingText, content: content.trim() });
      });

      // Fallback: grab body text
      let bodyText =
        doc.querySelector("article, main, .content, #content")?.textContent ||
        doc.body?.textContent ||
        "";
      bodyText = bodyText.replace(/\s+/g, " ").trim();

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
 * Summarize a document by extracting key sections.
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
          "Read a document from a URL. Supports HTML web pages, plain text, and JSON. Extracts and returns the text content.",
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
          "Read a document and extract key information, sections, and metadata.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL of the document" },
            focus: {
              type: "string",
              description: "Optional focus topic for the extraction",
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

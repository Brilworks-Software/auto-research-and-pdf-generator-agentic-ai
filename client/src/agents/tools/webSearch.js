/**
 * Web Search Tools (browser-compatible)
 *
 * Uses DuckDuckGo, Google Custom Search, and Wikipedia APIs.
 * HTML parsing is done via the browser's native DOMParser instead of cheerio.
 */

const GOOGLE_CSE_KEY = import.meta.env.VITE_GOOGLE_CSE_KEY || "";
const GOOGLE_CSE_CX = import.meta.env.VITE_GOOGLE_CSE_CX || "";

/**
 * Search the web using DuckDuckGo / Google Custom Search.
 */
export async function webSearch({ query, maxResults = 5 }) {
  console.log(`    [webSearch] Searching: "${query}"`);

  // Strategy 1: Google Custom Search if configured
  if (GOOGLE_CSE_KEY && GOOGLE_CSE_CX) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_KEY}&cx=${GOOGLE_CSE_CX}&q=${encodeURIComponent(query)}&num=${maxResults}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.items?.length) {
        return data.items.map((item) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
        }));
      }
    } catch (e) {
      console.warn("    [webSearch] Google CSE failed, falling back:", e.message);
    }
  }

  // Strategy 2: DuckDuckGo Instant Answer (free, no API key)
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl, {
      headers: { "User-Agent": "MultiAgentResearch/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    const results = [];

    if (data.Abstract) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || "",
        snippet: data.Abstract,
      });
    }

    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, maxResults)) {
        if (topic.Text) {
          results.push({
            title: topic.Text.slice(0, 80),
            url: topic.FirstURL || "",
            snippet: topic.Text,
          });
        }
      }
    }

    if (results.length) return results;
  } catch (e) {
    console.warn("    [webSearch] DuckDuckGo failed:", e.message);
  }

  // Strategy 3: Wikipedia API as final fallback
  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await fetch(wikiUrl, {
      headers: { "User-Agent": "MultiAgentResearch/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return [
        {
          title: data.title,
          url: data.content_urls?.desktop?.page || "",
          snippet: data.extract || "No summary available.",
        },
      ];
    }
  } catch {
    // ignore
  }

  return [{ title: query, url: "", snippet: "No results found." }];
}

/**
 * Fetch a URL and extract the main text content.
 * Uses browser DOMParser instead of cheerio.
 */
export async function fetchWebPage({ url }) {
  console.log(`    [fetchWebPage] Fetching: ${url}`);
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    const contentType = res.headers.get("content-type") || "";
    const html = await res.text();

    if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Remove noise elements
      ["script", "style", "nav", "footer", "header", "aside"].forEach((tag) => {
        doc.querySelectorAll(tag).forEach((el) => el.remove());
      });

      // Try to find article content
      const selectors = ["article", "main", ".content", ".post-content", "#content", ".article-body"];
      let text = "";
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (el) {
          text = el.textContent || "";
          break;
        }
      }
      if (!text) text = doc.body?.textContent || "";

      text = text.replace(/\s+/g, " ").trim();
      return { url, content: text.slice(0, 8000), contentLength: text.length };
    }

    return { url, content: html.slice(0, 8000), contentLength: html.length };
  } catch (err) {
    return { url, content: "", error: err.message };
  }
}

// ── Tool declarations ─────────────────────────────────────────────────────────
export const webSearchToolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "webSearch",
        description:
          "Search the web for information on a given query. Returns a list of results with title, URL, and snippet.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query string" },
            maxResults: {
              type: "number",
              description: "Maximum number of results to return (default 5)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "fetchWebPage",
        description:
          "Fetch a web page by URL and extract the main text content.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "The full URL to fetch" },
          },
          required: ["url"],
        },
      },
    ],
  },
];

export const webSearchToolHandlers = {
  webSearch,
  fetchWebPage,
};

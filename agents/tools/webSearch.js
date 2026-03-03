/**
 * Web Search Tools
 *
 * Provides web searching capabilities using multiple strategies:
 *  1. Google Custom Search API (if configured)
 *  2. DuckDuckGo Instant Answer API (free, no key required)
 *  3. Direct URL fetching and content extraction
 */
import * as cheerio from "cheerio";

// ── Google Custom Search (optional) ───────────────────────────────────────────
const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY || "";
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX || "";

/**
 * Search the web using DuckDuckGo Instant Answer API (always available).
 */
export async function webSearch({ query, maxResults = 5 }) {
  console.log(`    [webSearch] Searching: "${query}"`);

  // Strategy 1: Try Google Custom Search if configured
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

  // Strategy 3: Use Wikipedia API as a final fallback
  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await fetch(wikiUrl, {
      headers: { "User-Agent": "MultiAgentResearch/1.0" },
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
 */
export async function fetchWebPage({ url }) {
  console.log(`    [fetchWebPage] Fetching: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = res.headers.get("content-type") || "";
    const html = await res.text();

    if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
      const $ = cheerio.load(html);

      // Remove noise
      $("script, style, nav, footer, header, aside, .ad, .ads, .sidebar, .menu, .nav").remove();

      // Try to extract article content
      const selectors = ["article", "main", ".content", ".post-content", "#content", ".article-body"];
      let text = "";
      for (const sel of selectors) {
        const el = $(sel);
        if (el.length) {
          text = el.text();
          break;
        }
      }
      if (!text) text = $("body").text();

      // Clean up whitespace
      text = text.replace(/\s+/g, " ").trim();
      return { url, content: text.slice(0, 8000), contentLength: text.length };
    }

    // Plain text
    return { url, content: html.slice(0, 8000), contentLength: html.length };
  } catch (err) {
    return { url, content: "", error: err.message };
  }
}

// ── Tool declarations for Gemini ──────────────────────────────────────────────
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
          "Fetch a web page by URL and extract the main text content. Useful for reading articles, blog posts, documentation, etc.",
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

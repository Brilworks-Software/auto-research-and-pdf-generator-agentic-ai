/**
 * Wikipedia Tools
 *
 * Deep Wikipedia research capabilities:
 *  • Full article content (not just summary)
 *  • Related articles & links
 *  • Section-by-section extraction
 *  • Multiple language support
 *  • Category browsing
 */

const WIKI_API = "https://en.wikipedia.org/api/rest_v1";
const WIKI_ACTION_API = "https://en.wikipedia.org/w/api.php";
const UA = "MultiAgentResearch/2.0 (Academic Research Bot)";

/**
 * Get a concise summary of a Wikipedia article.
 */
export async function wikiSummary({ topic }) {
  console.log(`    [wikiSummary] Topic: "${topic}"`);
  try {
    const res = await fetch(`${WIKI_API}/page/summary/${encodeURIComponent(topic)}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { topic, error: `HTTP ${res.status}` };
    const data = await res.json();
    return {
      title: data.title,
      description: data.description || "",
      extract: data.extract || "",
      url: data.content_urls?.desktop?.page || "",
      thumbnail: data.thumbnail?.source || "",
      type: data.type,
    };
  } catch (err) {
    return { topic, error: err.message };
  }
}

/**
 * Get FULL Wikipedia article content with all sections.
 */
export async function wikiFullArticle({ topic }) {
  console.log(`    [wikiFullArticle] Topic: "${topic}"`);
  try {
    // Get parsed article content
    const url =
      `${WIKI_ACTION_API}?action=parse&page=${encodeURIComponent(topic)}` +
      `&prop=text|sections|categories|links|externallinks|displaytitle` +
      `&format=json&redirects=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();

    if (data.error) return { topic, error: data.error.info };

    const parse = data.parse;

    // Extract plain text from HTML via a simple regex-based stripper
    const html = parse.text?.["*"] || "";
    const plainText = html
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "") // remove references inline
      .replace(/<\/?[^>]+(>|$)/g, " ")             // strip HTML tags
      .replace(/\[\d+\]/g, "")                     // remove citation numbers
      .replace(/&[a-z]+;/gi, " ")                  // remove HTML entities
      .replace(/\s+/g, " ")
      .trim();

    // Extract sections
    const sections = (parse.sections || []).map((s) => ({
      number: s.number,
      heading: s.line,
      level: s.level,
    }));

    // Extract categories
    const categories = (parse.categories || []).map((c) => c["*"]).slice(0, 15);

    // Extract external links
    const externalLinks = (parse.externallinks || []).slice(0, 20);

    return {
      title: parse.displaytitle || topic,
      content: plainText.slice(0, 15000),
      contentLength: plainText.length,
      sections,
      categories,
      externalLinks,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}`,
    };
  } catch (err) {
    return { topic, error: err.message };
  }
}

/**
 * Search Wikipedia for articles matching a query.
 */
export async function wikiSearch({ query, limit = 10 }) {
  console.log(`    [wikiSearch] Query: "${query}" (limit: ${limit})`);
  try {
    const url =
      `${WIKI_ACTION_API}?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
      `&srlimit=${limit}&srprop=snippet|titlesnippet|wordcount|timestamp` +
      `&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    const results = (data.query?.search || []).map((r) => ({
      title: r.title,
      snippet: (r.snippet || "").replace(/<[^>]+>/g, ""),
      wordCount: r.wordcount,
      timestamp: r.timestamp,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
    }));

    return { query, resultCount: results.length, results };
  } catch (err) {
    return { query, error: err.message, results: [] };
  }
}

/**
 * Get specific sections of a Wikipedia article.
 */
export async function wikiSections({ topic, sectionNumbers = [] }) {
  console.log(`    [wikiSections] Topic: "${topic}" Sections: ${sectionNumbers.join(",") || "all"}`);
  try {
    const sectionsText = [];

    for (const secNum of sectionNumbers.slice(0, 8)) {
      const url =
        `${WIKI_ACTION_API}?action=parse&page=${encodeURIComponent(topic)}` +
        `&prop=text&section=${secNum}&format=json&redirects=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data.parse?.text?.["*"]) {
        const text = data.parse.text["*"]
          .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
          .replace(/<\/?[^>]+(>|$)/g, " ")
          .replace(/\[\d+\]/g, "")
          .replace(/&[a-z]+;/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        sectionsText.push({ section: secNum, content: text.slice(0, 3000) });
      }
    }

    return { topic, sections: sectionsText };
  } catch (err) {
    return { topic, error: err.message };
  }
}

/**
 * Get related/linked articles from a Wikipedia page.
 */
export async function wikiRelatedTopics({ topic, limit = 15 }) {
  console.log(`    [wikiRelatedTopics] Topic: "${topic}"`);
  try {
    const url =
      `${WIKI_ACTION_API}?action=query&titles=${encodeURIComponent(topic)}` +
      `&prop=links&pllimit=${limit}&plnamespace=0&format=json&redirects=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    const pages = data.query?.pages || {};
    const links = Object.values(pages)[0]?.links || [];
    return {
      topic,
      relatedTopics: links.map((l) => l.title).slice(0, limit),
    };
  } catch (err) {
    return { topic, error: err.message, relatedTopics: [] };
  }
}

/**
 * Books & Documentation Tools (browser-compatible)
 *
 * Provides access to:
 *  • Google Books API — search books, get previews & metadata
 *  • Open Library API — free book data & full-text access
 *  • Documentation sites via DuckDuckGo
 */

const UA = "MultiAgentResearch/2.0 (Academic Research Bot)";

export async function searchGoogleBooks({ query, maxResults = 8 }) {
  console.log(`    [searchGoogleBooks] Query: "${query}" (max: ${maxResults})`);
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&printType=books&orderBy=relevance`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    const data = await res.json();

    const books = (data.items || []).map((item) => {
      const v = item.volumeInfo || {};
      return {
        title: v.title || "",
        subtitle: v.subtitle || "",
        authors: v.authors || [],
        publisher: v.publisher || "",
        publishedDate: v.publishedDate || "",
        description: (v.description || "").slice(0, 600),
        pageCount: v.pageCount || 0,
        categories: v.categories || [],
        averageRating: v.averageRating || null,
        ratingsCount: v.ratingsCount || 0,
        language: v.language || "",
        previewLink: v.previewLink || "",
        infoLink: v.infoLink || "",
        isbn: v.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ||
              v.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier || "",
      };
    });

    return { query, resultCount: books.length, books };
  } catch (err) {
    return { query, error: err.message, books: [] };
  }
}

export async function searchOpenLibrary({ query, limit = 8 }) {
  console.log(`    [searchOpenLibrary] Query: "${query}"`);
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=key,title,author_name,first_publish_year,publisher,subject,edition_count,number_of_pages_median,ratings_average,cover_i`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    const data = await res.json();

    const books = (data.docs || []).map((doc) => ({
      title: doc.title || "",
      authors: doc.author_name || [],
      firstPublished: doc.first_publish_year || null,
      publishers: (doc.publisher || []).slice(0, 3),
      subjects: (doc.subject || []).slice(0, 8),
      editions: doc.edition_count || 0,
      pages: doc.number_of_pages_median || null,
      rating: doc.ratings_average || null,
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : "",
      openLibraryUrl: doc.key ? `https://openlibrary.org${doc.key}` : "",
    }));

    return { query, resultCount: books.length, books };
  } catch (err) {
    return { query, error: err.message, books: [] };
  }
}

export async function getOpenLibraryBook({ workKey }) {
  console.log(`    [getOpenLibraryBook] Key: ${workKey}`);
  try {
    const url = `https://openlibrary.org${workKey}.json`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    let description = "";
    if (typeof data.description === "string") description = data.description;
    else if (data.description?.value) description = data.description.value;

    return {
      title: data.title || "",
      description: description.slice(0, 1500),
      subjects: (data.subjects || []).map((s) => (typeof s === "string" ? s : s.name || "")).slice(0, 10),
      firstPublishDate: data.first_publish_date || "",
      covers: (data.covers || []).slice(0, 3).map((id) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`),
      links: (data.links || []).map((l) => ({ title: l.title, url: l.url })).slice(0, 5),
    };
  } catch (err) {
    return { workKey, error: err.message };
  }
}

export async function searchDocumentation({ query, sites = [] }) {
  console.log(`    [searchDocumentation] Query: "${query}"`);

  const defaultSites = [
    "docs.python.org",
    "developer.mozilla.org",
    "docs.microsoft.com",
    "docs.aws.amazon.com",
    "cloud.google.com/docs",
  ];

  const targetSites = sites.length ? sites : defaultSites;
  const siteFilter = targetSites.slice(0, 5).map((s) => `site:${s}`).join(" OR ");
  const fullQuery = `${query} (${siteFilter})`;

  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(fullQuery)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    const results = [];
    if (data.Abstract) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || "",
        snippet: data.Abstract,
        source: "documentation",
      });
    }
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 8)) {
        if (topic.Text) {
          results.push({
            title: topic.Text.slice(0, 100),
            url: topic.FirstURL || "",
            snippet: topic.Text,
            source: "documentation",
          });
        }
      }
    }
    return { query, resultCount: results.length, results };
  } catch (err) {
    return { query, error: err.message, results: [] };
  }
}

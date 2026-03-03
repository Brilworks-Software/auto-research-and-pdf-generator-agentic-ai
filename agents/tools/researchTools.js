/**
 * Research Paper Tools
 *
 * Provides access to academic research via:
 *  • arXiv API – preprints in physics, CS, math, etc.
 *  • Semantic Scholar API – broad academic database
 *  • CrossRef API – DOI resolution and metadata
 */

/**
 * Search arXiv for research papers.
 */
export async function searchArxiv({ query, maxResults = 5 }) {
  console.log(`    [searchArxiv] Query: "${query}" (max ${maxResults})`);
  try {
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const xml = await res.text();

    // Simple XML parsing for arXiv Atom feed
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];
      const get = (tag) => {
        const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].trim() : "";
      };
      const getAll = (tag) => {
        const matches = [];
        const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
        let m2;
        while ((m2 = r.exec(entry)) !== null) matches.push(m2[1].trim());
        return matches;
      };

      // Get PDF link
      const pdfMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
      const pdfUrl = pdfMatch ? pdfMatch[1] : "";

      entries.push({
        title: get("title").replace(/\s+/g, " "),
        authors: getAll("name").slice(0, 5),
        summary: get("summary").replace(/\s+/g, " ").slice(0, 500),
        published: get("published"),
        updated: get("updated"),
        pdfUrl,
        arxivId: get("id"),
        categories: entry.match(/term="([^"]+)"/g)?.map((m) => m.slice(6, -1)) || [],
      });
    }

    return { query, resultCount: entries.length, papers: entries };
  } catch (err) {
    return { query, error: err.message, papers: [] };
  }
}

/**
 * Search Semantic Scholar for academic papers.
 */
export async function searchSemanticScholar({ query, maxResults = 5 }) {
  console.log(`    [searchSemanticScholar] Query: "${query}"`);
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${maxResults}&fields=title,abstract,authors,year,citationCount,url,externalIds,publicationDate`;
    const res = await fetch(url, {
      headers: { "User-Agent": "MultiAgentResearch/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();

    const papers = (data.data || []).map((p) => ({
      title: p.title,
      authors: p.authors?.map((a) => a.name).slice(0, 5) || [],
      abstract: (p.abstract || "").slice(0, 500),
      year: p.year,
      citations: p.citationCount,
      url: p.url,
      doi: p.externalIds?.DOI || "",
      published: p.publicationDate || "",
    }));

    return { query, resultCount: papers.length, papers };
  } catch (err) {
    return { query, error: err.message, papers: [] };
  }
}

/**
 * Get detailed information about a specific paper by its Semantic Scholar ID, DOI, or arXiv ID.
 */
export async function getPaperDetails({ paperId }) {
  console.log(`    [getPaperDetails] Paper: ${paperId}`);
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}?fields=title,abstract,authors,year,citationCount,referenceCount,url,venue,publicationDate,externalIds,tldr,fieldsOfStudy`;
    const res = await fetch(url, {
      headers: { "User-Agent": "MultiAgentResearch/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const p = await res.json();

    return {
      title: p.title,
      authors: p.authors?.map((a) => a.name) || [],
      abstract: p.abstract || "",
      tldr: p.tldr?.text || "",
      year: p.year,
      venue: p.venue || "",
      citations: p.citationCount,
      references: p.referenceCount,
      fieldsOfStudy: p.fieldsOfStudy || [],
      url: p.url,
      doi: p.externalIds?.DOI || "",
      arxivId: p.externalIds?.ArXiv || "",
      published: p.publicationDate || "",
    };
  } catch (err) {
    return { paperId, error: err.message };
  }
}

/**
 * Resolve a DOI to get paper metadata via CrossRef.
 */
export async function resolveDOI({ doi }) {
  console.log(`    [resolveDOI] DOI: ${doi}`);
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "MultiAgentResearch/1.0 (mailto:research@example.com)" },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const work = data.message;

    return {
      doi,
      title: work.title?.[0] || "",
      authors:
        work.author?.map((a) => `${a.given || ""} ${a.family || ""}`.trim()) || [],
      journal: work["container-title"]?.[0] || "",
      publisher: work.publisher || "",
      published: work.created?.["date-parts"]?.[0]?.join("-") || "",
      type: work.type || "",
      url: work.URL || "",
      abstract: (work.abstract || "").replace(/<[^>]*>/g, "").slice(0, 500),
      references: work["references-count"] || 0,
      citations: work["is-referenced-by-count"] || 0,
    };
  } catch (err) {
    return { doi, error: err.message };
  }
}

// ── Tool declarations ─────────────────────────────────────────────────────────
export const researchToolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "searchArxiv",
        description:
          "Search arXiv for research preprints. Great for recent papers in CS, physics, math, biology, and more.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query for finding papers" },
            maxResults: { type: "number", description: "Max papers to return (default 5)" },
          },
          required: ["query"],
        },
      },
      {
        name: "searchSemanticScholar",
        description:
          "Search Semantic Scholar academic database for peer-reviewed papers. Broader coverage than arXiv.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query for finding papers" },
            maxResults: { type: "number", description: "Max papers to return (default 5)" },
          },
          required: ["query"],
        },
      },
      {
        name: "getPaperDetails",
        description:
          "Get detailed information about a specific paper using its Semantic Scholar ID, DOI (prefix with DOI:), or arXiv ID (prefix with ARXIV:).",
        parameters: {
          type: "object",
          properties: {
            paperId: {
              type: "string",
              description: "Paper identifier — Semantic Scholar ID, DOI:xxx, or ARXIV:xxx",
            },
          },
          required: ["paperId"],
        },
      },
      {
        name: "resolveDOI",
        description:
          "Resolve a DOI to get paper metadata from CrossRef (title, authors, journal, citations, etc.).",
        parameters: {
          type: "object",
          properties: {
            doi: { type: "string", description: "The DOI to resolve, e.g., 10.1000/xyz123" },
          },
          required: ["doi"],
        },
      },
    ],
  },
];

export const researchToolHandlers = {
  searchArxiv,
  searchSemanticScholar,
  getPaperDetails,
  resolveDOI,
};

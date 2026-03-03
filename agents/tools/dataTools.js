/**
 * Data Collection & Processing Tools
 *
 * Provides utilities for:
 *  • Fetching data from REST APIs
 *  • Aggregating / deduplicating collected data
 *  • Simple statistical analysis
 *  • Data storage in an in-memory knowledge base
 */

// In-memory knowledge base shared across agent invocations
const knowledgeBase = {
  entries: [],
  tags: new Map(),
};

/**
 * Fetch data from a public REST API endpoint.
 */
export async function fetchAPI({ url, method = "GET", headers = {} }) {
  console.log(`    [fetchAPI] ${method} ${url}`);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "User-Agent": "MultiAgentResearch/1.0",
        Accept: "application/json",
        ...headers,
      },
      signal: AbortSignal.timeout(15000),
    });
    const contentType = res.headers.get("content-type") || "";
    let data;
    if (contentType.includes("json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return {
      status: res.status,
      url,
      data: typeof data === "string" ? data.slice(0, 8000) : data,
    };
  } catch (err) {
    return { url, error: err.message };
  }
}

/**
 * Store a piece of information in the knowledge base.
 */
export async function storeData({ title, content, source, tags = [] }) {
  console.log(`    [storeData] Storing: "${title}"`);
  const entry = {
    id: knowledgeBase.entries.length + 1,
    title,
    content: typeof content === "string" ? content : JSON.stringify(content),
    source,
    tags,
    timestamp: new Date().toISOString(),
  };
  knowledgeBase.entries.push(entry);

  for (const tag of tags) {
    if (!knowledgeBase.tags.has(tag)) knowledgeBase.tags.set(tag, []);
    knowledgeBase.tags.get(tag).push(entry.id);
  }

  return { stored: true, id: entry.id, totalEntries: knowledgeBase.entries.length };
}

/**
 * Retrieve all stored data, optionally filtered by tag.
 */
export async function retrieveData({ tag = "" }) {
  console.log(`    [retrieveData] Retrieving${tag ? ` (tag: ${tag})` : " all"}`);
  if (tag && knowledgeBase.tags.has(tag)) {
    const ids = knowledgeBase.tags.get(tag);
    return {
      tag,
      entries: knowledgeBase.entries.filter((e) => ids.includes(e.id)),
    };
  }
  return {
    totalEntries: knowledgeBase.entries.length,
    entries: knowledgeBase.entries,
  };
}

/**
 * Deduplicate entries based on title similarity.
 */
export async function deduplicateData() {
  console.log(`    [deduplicateData] Deduplicating ${knowledgeBase.entries.length} entries`);
  const seen = new Map();
  const unique = [];
  for (const entry of knowledgeBase.entries) {
    const key = entry.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(key)) {
      seen.set(key, true);
      unique.push(entry);
    }
  }
  const removed = knowledgeBase.entries.length - unique.length;
  knowledgeBase.entries = unique;
  return { deduplicated: true, removed, remaining: unique.length };
}

/**
 * Get basic statistics about the collected data.
 */
export async function getDataStats() {
  const tagCounts = {};
  for (const [tag, ids] of knowledgeBase.tags) {
    tagCounts[tag] = ids.length;
  }
  return {
    totalEntries: knowledgeBase.entries.length,
    tags: tagCounts,
    sources: [...new Set(knowledgeBase.entries.map((e) => e.source))],
    oldestEntry: knowledgeBase.entries[0]?.timestamp || null,
    newestEntry: knowledgeBase.entries.at(-1)?.timestamp || null,
  };
}

// ── Tool declarations ─────────────────────────────────────────────────────────
export const dataToolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "fetchAPI",
        description:
          "Fetch data from a REST API endpoint. Returns the JSON or text response.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "The API endpoint URL" },
            method: { type: "string", description: "HTTP method (default: GET)" },
          },
          required: ["url"],
        },
      },
      {
        name: "storeData",
        description:
          "Store a piece of collected information in the knowledge base for later use.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Title/label for this data entry" },
            content: { type: "string", description: "The data content to store" },
            source: { type: "string", description: "Where this data came from (URL, paper ID, etc.)" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for categorising this entry",
            },
          },
          required: ["title", "content", "source"],
        },
      },
      {
        name: "retrieveData",
        description:
          "Retrieve stored data from the knowledge base. Optionally filter by tag.",
        parameters: {
          type: "object",
          properties: {
            tag: { type: "string", description: "Optional tag to filter by" },
          },
        },
      },
      {
        name: "deduplicateData",
        description: "Remove duplicate entries from the knowledge base based on title similarity.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "getDataStats",
        description: "Get statistics about the data collected so far (counts, tags, sources).",
        parameters: { type: "object", properties: {} },
      },
    ],
  },
];

export const dataToolHandlers = {
  fetchAPI,
  storeData,
  retrieveData,
  deduplicateData,
  getDataStats,
};

/** Expose the knowledge base for the report agent */
export { knowledgeBase };

/**
 * Serverless function for /api/research endpoint
 * Handles research queries and streams results via Server-Sent Events
 */
import { runManager } from "../agents/manager.js";

export default async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Only accept POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { query } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "Missing 'query' in request body." });
  }

  console.log(`\n📨 API request: "${query}"\n`);

  // Set up Server-Sent Events streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendUpdate = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const report = await runManager(query.trim(), sendUpdate);
    sendUpdate("report", { report });
    res.end();
  } catch (err) {
    console.error("❌ API Error:", err.message);
    sendUpdate("error", { error: err.message });
    res.end();
  }
};

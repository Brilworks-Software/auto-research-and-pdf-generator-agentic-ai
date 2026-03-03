/**
 * Express API Server for the Multi-Agent Research System
 * Exposes the runManager pipeline as a REST API.
 */
import express from "express";
import cors from "cors";
import MarkdownIt from "markdown-it";
import puppeteer from "puppeteer";
import { runManager } from "./agents/manager.js";

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── POST /api/research ────────────────────────────────────────────────────────
// Accepts { query: "..." } and streams progress updates showing active sources.
app.post("/api/research", async (req, res) => {
  const { query } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "Missing 'query' in request body." });
  }

  console.log(`\n📨 API request: "${query}"\n`);

  // Set up streaming response
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

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
});

// ── POST /api/pdf ─────────────────────────────────────────────────────────
// Accepts { markdown: "...", filename: "..." } and returns a PDF file.
app.post("/api/pdf", async (req, res) => {
  const { markdown, filename } = req.body;

  if (!markdown || !markdown.trim()) {
    return res.status(400).json({ error: "Missing 'markdown' in request body." });
  }

  try {
    const htmlBody = md.render(markdown);
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.7;
      color: #1a1a2e;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 { font-size: 28px; margin: 32px 0 16px; color: #1a1a2e; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
    h2 { font-size: 22px; margin: 28px 0 12px; color: #2d2d5e; }
    h3 { font-size: 18px; margin: 24px 0 10px; color: #3d3d7e; }
    h4, h5, h6 { font-size: 16px; margin: 20px 0 8px; }
    p { margin: 10px 0; }
    pre {
      background: #f4f4f8;
      border: 1px solid #e0e0e8;
      border-radius: 6px;
      padding: 14px;
      overflow-x: auto;
      font-size: 13px;
    }
    code {
      background: #f0f0f5;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 13px;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid #6366f1;
      padding: 10px 16px;
      margin: 16px 0;
      background: #f8f8fc;
      color: #4a4a6a;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #d0d0d8;
      padding: 10px 14px;
      text-align: left;
    }
    th { background: #f4f4f8; font-weight: 600; }
    a { color: #6366f1; text-decoration: none; }
    ul, ol { margin: 10px 0; padding-left: 24px; }
    li { margin: 4px 0; }
    hr { border: none; border-top: 1px solid #e0e0e8; margin: 24px 0; }
    img { max-width: 100%; }
  </style>
</head>
<body>${htmlBody}</body>
</html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
      printBackground: true,
    });
    await browser.close();

    const safeName = (filename || "research_report").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ PDF generation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Research API server running at http://localhost:${PORT}`);
  console.log(`   POST /api/research  { "query": "your question" }\n`);
});

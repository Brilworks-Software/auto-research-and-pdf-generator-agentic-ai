import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function App() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSources, setActiveSources] = useState({});
  const [completedSources, setCompletedSources] = useState(new Set());
  const messagesEndRef = useRef(null);

  // Define all available data sources
  const DATA_SOURCES = {
    web: { name: "Web Search", icon: "🌐", color: "#00d4ff" },
    wikipedia: { name: "Wikipedia", icon: "📖", color: "#3366ff" },
    research: { name: "Research Papers", icon: "📄", color: "#ff6b6b" },
    books: { name: "Books & Docs", icon: "📚", color: "#ffa500" },
    datacollector: { name: "Data Aggregator", icon: "📊", color: "#9d4edd" },
    reportAgent: { name: "Report Generator", icon: "📝", color: "#ff69b4" },
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, activeSources]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuery("");
    setLoading(true);
    setActiveSources({});
    setCompletedSources(new Set());

    try {
      const res = await fetch(`${API_URL}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      // Handle streaming response
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === "source_active") {
                  setActiveSources((prev) => ({
                    ...prev,
                    [data.source]: true,
                  }));
                } else if (data.type === "source_complete") {
                  setActiveSources((prev) => {
                    const newActives = { ...prev };
                    delete newActives[data.source];
                    return newActives;
                  });
                  setCompletedSources((prev) => new Set([...prev, data.source]));
                } else if (data.type === "report") {
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: data.report },
                  ]);
                }
              } catch (parseErr) {
                console.error("Failed to parse stream data:", parseErr);
              }
            }
          }
          
          buffer = lines[lines.length - 1];
        }
      } else {
        // Fallback for non-streaming response
        const data = await res.json();
        if (data.success) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.report },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `**Error:** ${data.error || "Something went wrong."}`,
            },
          ]);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `**Connection Error:** ${err.message}\n\nMake sure the backend server is running on port 3001.`,
        },
      ]);
    } finally {
      setLoading(false);
      setActiveSources({});
    }
  };

  const handleDownloadPDF = async (markdownContent, topic) => {
    // Sanitize topic for use as filename
    const stopWords = ["what", "is", "are", "the", "a", "an", "of", "and", "or", "in", "on", "for", "to", "how", "why", "where", "when", "which", "do", "does", "did", "its", "it", "this", "that"];
    const safeName = (topic || "research_report")
      .toLowerCase()
      .replace(/[<>:"\/|?*,.!;'(){}[\]]/g, "")
      .split(/\s+/)
      .filter((w) => w && !stopWords.includes(w))
      .join("_")
      .substring(0, 100) || "research_report";

    try {
      const res = await fetch(`${API_URL}/api/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: markdownContent, filename: safeName }),
      });

      if (!res.ok) {
        const text = await res.text();
        let errorMsg = "PDF generation failed";
        try {
          const errData = JSON.parse(text);
          errorMsg = errData.error || errorMsg;
        } catch {
          errorMsg = text.substring(0, 200) || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
      alert(`PDF download failed: ${err.message}`);
    }
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🧠</span>
            <h1>AI Research</h1>
          </div>
          <p className="tagline">Multi-Agent Deep Research System</p>
        </div>

        <div className="sidebar-agents">
          <h3>Active Agents</h3>
          <ul>
            <li><span className="agent-icon">🔍</span> Web Search</li>
            <li><span className="agent-icon">📄</span> Doc Reader</li>
            <li><span className="agent-icon">📚</span> Research Papers</li>
            <li><span className="agent-icon">📖</span> Books &amp; Docs</li>
            <li><span className="agent-icon">🌐</span> Wikipedia</li>
            <li><span className="agent-icon">📊</span> Data Collector</li>
            <li><span className="agent-icon">📝</span> Report Generator</li>
          </ul>
        </div>

        <div className="sidebar-footer">
          <p>Powered by Gemini AI</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {/* Messages Area */}
        <div className="messages-area">
          {messages.length === 0 && !loading && (
            <div className="welcome">
              <div className="welcome-icon">🔬</div>
              <h2>Welcome to AI Research</h2>
              <p>
                Ask any research question and our multi-agent system will search
                the web, academic papers, Wikipedia, books, and documentation to
                generate a comprehensive report.
              </p>
              <div className="example-queries">
                <h4>Try asking:</h4>
                <button onClick={() => setQuery("What is quantum computing and its applications?")}>
                  What is quantum computing and its applications?
                </button>
                <button onClick={() => setQuery("Impact of artificial intelligence on healthcare")}>
                  Impact of AI on healthcare
                </button>
                <button onClick={() => setQuery("History and future of space exploration")}>
                  History and future of space exploration
                </button>
              </div>

            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === "user" ? "👤" : "🧠"}
              </div>
              <div className="message-content">
                {msg.role === "user" ? (
                  <div className="user-text">{msg.content}</div>
                ) : (
                  <>
                    <div id={`report-${i}`} className="markdown-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    <div className="message-actions">
                      <button
                        className="btn-download"
                        onClick={() => {
                          // Find the user message before this assistant response
                          const userMsg = messages.slice(0, i).reverse().find(m => m.role === "user");
                          handleDownloadPDF(msg.content, userMsg?.content);
                        }}
                        title="Download as PDF"
                      >
                        📥 Download PDF
                      </button>
                      <button
                        className="btn-copy"
                        onClick={() => handleCopy(msg.content)}
                        title="Copy Markdown"
                      >
                        📋 Copy Markdown
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              <div className="message-avatar">🧠</div>
              <div className="message-content">
                <div className="loading-indicator">
                  <h3 className="loading-title">📡 Collecting Research Data</h3>
                  <p className="loading-subtitle">Gathering information from multiple sources...</p>
                  
                  <div className="data-sources-grid">
                    {Object.entries(DATA_SOURCES).map(([key, source]) => (
                      <div
                        key={key}
                        className={`source-item ${
                          activeSources[key]
                            ? "active"
                            : completedSources.has(key)
                            ? "completed"
                            : "pending"
                        }`}
                      >
                        <div className="source-icon">{source.icon}</div>
                        <div className="source-info">
                          <span className="source-name">{source.name}</span>
                          {activeSources[key] && (
                            <div className="activity-dots">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                          )}
                          {completedSources.has(key) && (
                            <span className="checkmark">✓</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="loading-message">
                    <p>{Object.keys(activeSources).length > 0 
                      ? `Actively collecting from: ${Object.keys(activeSources)
                          .map(k => DATA_SOURCES[k]?.name)
                          .filter(Boolean)
                          .join(", ")}`
                      : "Preparing research agents..."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form className="input-area" onSubmit={handleSubmit}>
          <div className="input-wrapper">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a research question..."
              disabled={loading}
              autoFocus
            />
            <button type="submit" disabled={loading || !query.trim()}>
              {loading ? "⏳ Researching..." : "🔍 Research"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default App;

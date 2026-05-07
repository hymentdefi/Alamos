import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

const DECISIONS_FILE = path.resolve(
  process.env.DECISIONS_FILE || path.join(process.cwd(), "context/strategy/decisions.md")
);

function readDecisions() {
  if (!fs.existsSync(DECISIONS_FILE)) return "";
  return fs.readFileSync(DECISIONS_FILE, "utf-8");
}

function parseDecisions(content) {
  const decisions = [];
  const blocks = content.split(/\n---\n/).filter((b) => b.trim());
  for (const block of blocks) {
    const idMatch = block.match(/## \[(\d{4}-[\dX]{2}-[\dX]{2})\] (.+)/);
    if (!idMatch) continue;
    const date = idMatch[1];
    const slug = idMatch[2].trim();
    const id = `${date}-${slug}`;
    const categoryMatch = block.match(/\*\*Categoría:\*\* (.+)/);
    const decisionMatch = block.match(/\*\*Decisión:\*\* (.+)/);
    const statusMatch = block.match(/\*\*Status:\*\* (.+)/);
    decisions.push({
      id, date, slug,
      category: categoryMatch?.[1]?.trim() || "Unknown",
      decision: decisionMatch?.[1]?.trim() || "",
      status: statusMatch?.[1]?.trim() || "Unknown",
      raw: block.trim(),
    });
  }
  return decisions;
}

const server = new McpServer({ name: "decisions-log", version: "1.0.0" });

server.tool("list_decisions", "List all decisions with their status", {}, async () => {
  const decisions = parseDecisions(readDecisions());
  if (decisions.length === 0) return { content: [{ type: "text", text: "No decisions found." }] };
  const summary = decisions.map((d) => `[${d.status}] ${d.id}: ${d.decision}`).join("\n");
  return { content: [{ type: "text", text: summary }] };
});

server.tool("search_decisions", "Search decisions by keyword or category",
  { query: z.string().describe("Search keyword") },
  async ({ query }) => {
    const decisions = parseDecisions(readDecisions());
    const q = query.toLowerCase();
    const matches = decisions.filter((d) =>
      d.raw.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q)
    );
    if (matches.length === 0) return { content: [{ type: "text", text: `No decisions matching "${query}".` }] };
    return { content: [{ type: "text", text: matches.map((d) => d.raw).join("\n\n---\n\n") }] };
  }
);

server.tool("get_decision", "Get a specific decision by ID or slug",
  { id: z.string().describe("Decision ID or slug") },
  async ({ id }) => {
    const match = parseDecisions(readDecisions()).find((d) => d.id === id || d.slug === id);
    if (!match) return { content: [{ type: "text", text: `Decision "${id}" not found.` }] };
    return { content: [{ type: "text", text: match.raw }] };
  }
);

server.tool("list_open_decisions", "List decisions with PROPUESTA status", {}, async () => {
  const open = parseDecisions(readDecisions()).filter((d) => d.status === "PROPUESTA");
  if (open.length === 0) return { content: [{ type: "text", text: "No open decisions." }] };
  return { content: [{ type: "text", text: open.map((d) => `${d.id}: ${d.decision}`).join("\n") }] };
});

server.tool("add_decision", "Add a new decision to the log", {
    date: z.string().describe("YYYY-MM-DD"),
    slug: z.string().describe("kebab-case slug"),
    category: z.string().describe("Strategy | Legal | Technical | Product | Fiscal"),
    decision: z.string().describe("What was decided"),
    alternatives: z.string().describe("Alternatives and why discarded"),
    rationale: z.string().describe("Why this option"),
    status: z.enum(["PROPUESTA", "DECIDIDO", "EJECUTANDO", "COMPLETADO", "REVERTIDO"]),
  },
  async ({ date, slug, category, decision, alternatives, rationale, status }) => {
    const entry = `\n---\n\n## [${date}] ${slug}\n\n**Categoría:** ${category}\n**Decisión:** ${decision}\n**Alternativas descartadas:**\n${alternatives}\n**Rationale:** ${rationale}\n**Status:** ${status}\n`;
    let content = readDecisions();
    const marker = "<!-- TEMPLATE PARA NUEVAS DECISIONES:";
    const idx = content.indexOf(marker);
    if (idx !== -1) {
      content = content.slice(0, idx).trimEnd() + "\n" + entry + "\n" + content.slice(idx);
    } else {
      content = content.trimEnd() + "\n" + entry;
    }
    fs.writeFileSync(DECISIONS_FILE, content, "utf-8");
    return { content: [{ type: "text", text: `Added: [${date}] ${slug} (${status})` }] };
  }
);

server.tool("update_decision_status", "Update status of a decision", {
    slug: z.string().describe("Decision slug"),
    new_status: z.enum(["PROPUESTA", "DECIDIDO", "EJECUTANDO", "COMPLETADO", "REVERTIDO"]),
  },
  async ({ slug, new_status }) => {
    let content = readDecisions();
    const match = parseDecisions(content).find((d) => d.slug === slug || d.id === slug);
    if (!match) return { content: [{ type: "text", text: `"${slug}" not found.` }] };
    const blockStart = content.indexOf(match.raw);
    if (blockStart === -1) return { content: [{ type: "text", text: "Could not locate block." }] };
    const updated = match.raw.replace(`**Status:** ${match.status}`, `**Status:** ${new_status}`);
    content = content.slice(0, blockStart) + updated + content.slice(blockStart + match.raw.length);
    fs.writeFileSync(DECISIONS_FILE, content, "utf-8");
    return { content: [{ type: "text", text: `Updated "${match.slug}": ${match.status} → ${new_status}` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

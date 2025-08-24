#!/usr/bin/env node
// ESM MCP server for detecting whether a call/message intent is spam
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import chalk from "chalk";
import { detectCallSpamIntent } from "../src/spamDetector.js";
import http from "node:http";

const TOOL_NAME = "detect_call_intent";

const DETECT_CALL_INTENT_TOOL = {
  name: TOOL_NAME,
  description:
    "Analyzes call or message text to determine if the intent is spam/scam, with confidence and reasons.",
  inputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Call transcript, voicemail, or message content to analyze",
      },
      callerId: {
        type: "string",
        description: "Caller ID or phone number (optional)",
      },
      direction: {
        type: "string",
        description: "Call direction (inbound/outbound)",
        enum: ["inbound", "outbound"],
      },
      locale: {
        type: "string",
        description: "Locale hint like en-US (optional)",
      },
      debug: {
        type: "boolean",
        description: "Include extra debug details in stderr logs",
      },
    },
    required: ["text"],
    additionalProperties: false,
  },
};

const server = new Server(
  { name: "spamsense-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [DETECT_CALL_INTENT_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name !== TOOL_NAME) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${request.params.name}`,
          },
        ],
        isError: true,
      };
    }

    const args = request.params.arguments ?? {};
    if (!args || typeof args.text !== "string" || !args.text.trim()) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "Missing required 'text' string in arguments" },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const analysis = detectCallSpamIntent({
      text: String(args.text),
      callerId: typeof args.callerId === "string" ? args.callerId : undefined,
      direction: args.direction === "inbound" || args.direction === "outbound" ? args.direction : undefined,
      locale: typeof args.locale === "string" ? args.locale : undefined,
    });

    const banner = analysis.isSpam
      ? chalk.red.bold("🚫 Spam Intent Detected")
      : analysis.label === "likely_spam"
      ? chalk.yellow.bold("⚠️ Likely Spam Intent")
      : chalk.green.bold("✅ Not Spam Intent");

    // Pretty stderr log for operators
    console.error(
      `${banner} ${chalk.gray(`(confidence: ${(analysis.confidence * 100).toFixed(0)}%)`)}`
    );
    if (args.debug) {
      console.error(chalk.cyan("Reasons:"), analysis.reasons.join("; "));
      if (analysis.matches?.length) {
        console.error(
          chalk.cyan("Matched Signals:"),
          analysis.matches.map((m) => `${m.type}:${m.pattern}[${m.weight}]`).join(", ")
        );
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
              status: "failed",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SpamSense MCP Server running on stdio");

  // If a port is provided (CLI or env), expose a tiny HTTP health server
  const argv = process.argv.slice(2);
  const portFlagIndex = argv.findIndex((a) => a === "--port" || a === "-p");
  const portArg = portFlagIndex >= 0 ? Number(argv[portFlagIndex + 1]) : undefined;
  const portEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
  const port = Number.isFinite(portArg) ? portArg : Number.isFinite(portEnv) ? portEnv : undefined;

  if (port) {
    const server = http.createServer((req, res) => {
      // Always return 200 for root and health checks
      if (req.url === "/" || req.url === "/health" || req.url === "/_health") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ status: "ok", service: "spamsense-mcp" }));
        return;
      }
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
    });
    server.listen(port, () => {
      console.error(`HTTP health server listening on :${port}`);
    });
  }
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

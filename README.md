SpamSense MCP Server
=====================

Detect whether a call/message intent is spam using a lightweight heuristic model, exposed as a Model Context Protocol (MCP) tool.

What it provides
----------------

- Tool `detect_call_intent`: Analyzes input text (call transcript, voicemail, or message) and returns:
  - `isSpam`: boolean classification
  - `label`: `spam`, `likely_spam`, or `not_spam`
  - `confidence`: 0–1
  - `intent`: coarse category (e.g., `scam/spam`, `sales`, `support`, `delivery`, etc.)
  - `reasons` and `matches` for explainability

Usage
-----

1) Install dependencies (requires network):

   npm install

2) Run the server (stdio):

   npm start

3) Connect via an MCP-compatible client and call the tool `detect_call_intent` with:

   {
     "text": "Hello, your account was suspended. Press 1 to verify.",
     "callerId": "+1-202-555-0100",
     "direction": "inbound",
     "debug": true
   }

Implementation Notes
--------------------

- Pure JavaScript (ESM), no external network calls or ML models.
- Heuristic rules and patterns are in `src/spamDetector.js`.
- Server entry at `bin/server.js` with `#!/usr/bin/env node` shebang.
- Requires Node.js 18+.

Development
-----------

- Adjust patterns/weights in `src/spamDetector.js` to tune precision/recall for your data.
- You can add more structured metadata to the tool schema as needed (e.g., language, channel, prior interactions).

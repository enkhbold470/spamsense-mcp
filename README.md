# Spamsense MCP Server

A TypeScript MCP server implementing a simple phone-number spam risk analysis tool. Built to be compatible with Dedalus Marketplace using streamable HTTP transport, following the guidelines in `dedalus-mcp-server-guideline/server-guidelines.md`.

## Features

- Streamable HTTP transport at `/mcp` with SSE fallback at `/sse`
- STDIO transport for local development
- Health check at `/health`
- Stateless; no external API key required
- Tool: `spamsense_check_phone` – analyze a phone number and return JSON with risk signals

## Usage

- Install dependencies and build:
  - `npm install`
  - `npm run build`
- Run HTTP server (default port 8080):
  - `npm start`
- Run STDIO transport:
  - `npm run start:stdio`

Environment variables:
- `PORT`: HTTP port (default: 8080)
- `NODE_ENV`: set to `production` for 0.0.0.0 binding
The server ships with a built-in blacklist of known-abusive numbers. Update it in `src/spamsense.ts` if needed.

## MCP client config example

When running locally on port 8080:

```
{
  "mcpServers": {
    "spamsense": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

## Dedalus Marketplace

- The main entry point is `src/index.ts`, compiled to `dist/index.js`.
- Uses `@modelcontextprotocol/sdk@^1.17.3` and the streamable HTTP transport.
- Health check available at `/health`.
- Binary name: `spamsense-mcp`.

## Docker

A minimal Dockerfile is provided for containerized deployment.

```
# Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.json ./
RUN npm ci || npm i
COPY src ./src
RUN npm run build

# Runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

## License

MIT

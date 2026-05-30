# pit-mcp-server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
your pit knowledge base as tools an LLM can call. Hand Claude a search query,
get back matched design references with a `pit://item/<id>` deep-link that
opens the item modal directly in pit.

## What it gives you

Three read-only tools over your local pit database:

| Tool | What it does |
| ---- | ------------ |
| `search_items(query, limit?, collection?, kind?)` | Fuzzy search across title, tags, palette (hex + role name), theme, components, fonts, prompt, url, free text. Returns up to N hits with a `pit://item/<id>` link the user can click to open the modal in pit. |
| `list_collections()` | All collections + item counts. Use this before `search_items` if the user names a topic ("the dashboards collection") so you can scope the search. |
| `get_item(id)` | Full record for one item — design tokens, palette, fonts, components, IA, motion, etc. Use after `search_items` when you need depth. Strips the raw screenshot blob (4–6 MB) so it doesn't blow up your context. |

Read-only by design. pit's main process owns writes; this server only ever
`SELECT`s. Safe to run concurrently because pit's SQLite is in WAL mode.

## Setup

```bash
cd infra/mcp-server
npm install
npm run build
```

This produces `dist/server.js` — the script you point Claude (or any MCP client)
at.

## Hook it into Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (or
create it) and add a `mcpServers` entry:

```json
{
  "mcpServers": {
    "pit": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/pit/infra/mcp-server/dist/server.js"]
    }
  }
}
```

Restart Claude Desktop. You should see a small wrench/tools icon in the chat
composer — Claude now knows about `search_items`, `list_collections`, and
`get_item`. Settings → Sharing in pit has a one-click "Copy mcp.json snippet"
button that fills the absolute path correctly.

Then ask Claude things like:

- *"Look in my pit and find a few clean SaaS dashboards with a dark theme."*
- *"What designs do I have that use orange (`#e8624a`) as the accent?"*
- *"Open the Cloudflare dashboard reference for me."* — Claude returns the
  `pit://item/...` link, you click it, pit jumps to the modal.

## Configuration

| Env var | Default | Meaning |
| ------- | ------- | ------- |
| `PIT_DB_PATH` | `~/Library/Application Support/pit/pit.db` (macOS) / `%APPDATA%/pit/pit.db` (Windows) / `$XDG_CONFIG_HOME/pit/pit.db` (Linux) | Where to find pit's SQLite database. Override if you ran pit with a custom user data dir. |

You don't normally touch this — pit creates the DB at its standard userData
path on first run, and the MCP server finds it automatically.

## Running standalone (without Claude Desktop)

For testing or use with another MCP client:

```bash
# Smoke test — initialise + list tools
cat <<EOF | node dist/server.js
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
EOF
```

It speaks JSON-RPC 2.0 over stdio — standard MCP transport. Any MCP-aware
client can drive it.

## Safety notes

- Read-only DB connection (`{ readonly: true }`). Cannot modify pit's data
  even if a tool implementation got it wrong.
- No network access. Everything stays on your machine.
- No authentication — relies on the OS-level boundary that MCP servers are
  spawned by the user's MCP client.
- Screenshot bytes (potentially sensitive captures) are **never** returned in
  tool responses. The LLM gets metadata + a `pit://item/<id>` deep link only.
  Pixels stay local.

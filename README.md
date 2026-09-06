# The Third Chair

The current private build provides Raven's Table as a ChatGPT developer-mode plugin: a live GPT-5.6 Sol Director and Narrator, a persistent SQLite campaign, six player-safe MCP tools, and a stateful table widget.

## Start Raven's Table on Windows

Prerequisites: Node 24, the private source pack at `private/source-pack.sqlite`, and `OPENAI_API_KEY` in the current PowerShell environment or the ignored root `.env` file. For the private ChatGPT connection, create or reuse a tunnel in [OpenAI Platform Tunnels](https://platform.openai.com/settings/organization/tunnels). The launcher uses `CONTROL_PLANE_API_KEY` when provided; otherwise it reuses `OPENAI_API_KEY` for the tunnel connection.

From the repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-ravens-table.ps1
```

The launcher builds the widget, starts the live server on loopback, downloads OpenAI's current tunnel runtime when needed, and verifies the private connection. If the tunnel ID is not already in the ignored `.env` file or PowerShell environment, it prompts for it. A separate restricted runtime key remains optional; when supplied, it is hidden while you paste it and is not saved by the launcher.

When the launcher says Raven's Table is ready, it copies the `tunnel_id` to the clipboard. In ChatGPT, enable Developer mode under **Settings → Security and login**, open **Plugins**, select the plus button, choose **Tunnel** under Connection, and select the tunnel or paste its ID. Create the plugin, review its six discovered tools, and add it to a new conversation to begin.

The MCP server remains bound to loopback. OpenAI Secure MCP Tunnel makes an outbound connection and keeps the server off the public internet. Leave the launcher window open while playing; `Ctrl+C` closes the server and tunnel connection.

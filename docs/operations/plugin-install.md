# Private Plugin Installation

The plugin root is `plugins/third-chair`. Its local Codex MCP entry points to `http://127.0.0.1:8787/mcp`. The four bundled skills are player play, campaign resume/audit, sourced rules, and private source-pack operations.

Build and validate the distributable from the repository root with `npm run package:plugin`. Validation invokes the installed plugin-creator validator, checks skill frontmatter and the private-file boundary, and writes the ignored archive `tmp/third-chair-plugin.zip`.

The package intentionally excludes PDFs, extracted text, OCR products, source/campaign SQLite databases, environment files, and raw agent prompts. The source pack remains a local read-only dependency outside the plugin archive.

`.app.json` is intentionally absent during local packaging. After the MCP server is exposed through an approved HTTPS endpoint and registered as a real ChatGPT connection, record its actual `plugin_asdk_app...` technical ID in `.app.json` and add `"apps": "./.app.json"` to the manifest. Never use a placeholder connection ID.

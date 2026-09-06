# Upstream Widget Basis

Checked on 2026-09-06 against the current official OpenAI Apps SDK examples repository.

- Repository: `https://github.com/openai/openai-apps-sdk-examples`
- Commit: `18cc38e78a968712c357bacdc3c79fead5bfc6b4`
- Smallest inspected hydration example: `src/show-tool-result`
- Server pattern inspected: `mcp_app_basics_node/src/server.ts`

Adopted patterns are limited to registering a tool-linked `ui://` resource, returning model-useful `structuredContent`, loading a built HTML asset at startup, and hydrating React from host tool results. Third Chair keeps its own contracts, visual language, data, tool names, and bridge-first lifecycle.

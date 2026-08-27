# The Third Chair

CHAIR-001 is a private, fake-model playable vertical slice. Run `THIRD_CHAIR_FAKE_MODE=1 npm run dev:server`, then use the Streamable HTTP MCP endpoint at `/mcp`. The only player-facing tools are `get_table_view` and `advance_game`; campaign truth, rolls, and state commits remain deterministic server code.

# OpenAI Runtime Basis

Checked on 2026-09-05 against the current official TypeScript Agents SDK documentation and the installed package declarations.

- Agents SDK quickstart: https://openai.github.io/openai-agents-js/guides/quickstart/
- Agents: https://openai.github.io/openai-agents-js/guides/agents/
- Tools: https://openai.github.io/openai-agents-js/guides/tools/
- Schema validation: https://openai.github.io/openai-agents-js/guides/schemas/
- Models: https://openai.github.io/openai-agents-js/guides/models/
- Running agents: https://openai.github.io/openai-agents-js/guides/running-agents/
- Results: https://openai.github.io/openai-agents-js/guides/results/
- Guardrails: https://openai.github.io/openai-agents-js/guides/guardrails/
- Tracing: https://openai.github.io/openai-agents-js/guides/tracing/
- OpenAI Agents SDK guide: https://developers.openai.com/api/docs/guides/agents
- GPT-5.6 Sol: https://developers.openai.com/api/docs/models/gpt-5.6-sol

Resolved npm package: `@openai/agents@0.17.0`.

The installed declarations place model, model settings, tools, and output type on a fresh `Agent`; local context, maximum turns, and abort signal on each non-streaming run; aggregate usage on the run state; and `traceIncludeSensitiveData` on `Runner` configuration. The application wrapper returns only final output and aggregate request/token counters. It supplies no SDK session and does not return SDK history or run state.

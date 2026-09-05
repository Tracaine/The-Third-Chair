# CHAIR-003 Real-Model Evaluation

The live gate runs four authority-focused paths against temporary campaign databases and the verified private source pack. It records only case name, pass/fail, elapsed time, final turn kind, roll count, and a normalized error code. Prompts, source passages, hidden state, narration, API credentials, and raw model output are never written to the result file.

Run from the repository root with locally configured `OPENAI_API_KEY`:

```powershell
npm run eval
```

Optional environment settings are `DIRECTOR_MODEL`, `NARRATOR_MODEL`, their reasoning settings, and `THIRD_CHAIR_SOURCE_PACK_DATABASE`. Normal play and evaluation keep SDK tracing disabled unless the explicit private-development trace controls are enabled together.

The 2026-09-05 [official OpenAI model catalog](https://developers.openai.com/api/docs/models) and [Agents SDK documentation](https://openai.github.io/openai-agents-js/guides/agents/) confirm the defaults `gpt-5.6-sol` and `gpt-5.6-terra`, including the configured reasoning efforts. Provider failures are reduced to safe operational codes such as quota, authentication, access, rate-limit, model, transport, and provider-availability classes; raw provider messages, request IDs, headers, and bodies are never written to eval results.

The four paths are a safe no-roll action, a meaningful locked check, forced narration failure after persisted dice, and process restart after persisted dice. Grading uses structured status, stored rolls, and RNG counters rather than prose style.

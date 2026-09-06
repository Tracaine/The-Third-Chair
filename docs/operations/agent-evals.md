# CHAIR-003 Real-Model Evaluation

The live gate runs four authority-focused paths against temporary campaign databases and the verified private source pack. It stops at the first failed path to avoid spending calls on downstream cases that cannot complete the gate. It records only case name, pass/fail, elapsed time, final turn kind, roll count, a normalized error code, and bounded structural issue paths/codes when Director repair fails. Prompts, source passages, hidden state, narration, API credentials, and raw model output are never written to the result file.

Before the four-case gate, run the one-Director-call private-development smoke from the repository root with locally configured `OPENAI_API_KEY`:

```powershell
$env:NODE_ENV='development'; $env:THIRD_CHAIR_PRIVATE_DEV='1'; npm run eval:director-smoke
```

This smoke uses the real Director request boundary and prints only bounded diagnostics: status, provider code/type, parameter, wrapper/root exception names, invoked tool name, application error code, and request ID when supplied. It never prints provider messages, headers, bodies, prompts, source passages, model-produced tool arguments, or credentials. Normal tracing remains disabled. After the smoke passes, run:

```powershell
npm run eval
```

During diagnosis, one named case can be selected without spending calls on already-proven cases:

```powershell
$env:CHAIR_003_EVAL_CASE='narration-failure-after-roll'; npm run eval
```

Remove `CHAIR_003_EVAL_CASE` before the final gate so all four cases run.

Both roles are fixed to `gpt-5.6-sol`; an environment model override is accepted only when it names that model. Optional environment settings are the reasoning settings and `THIRD_CHAIR_SOURCE_PACK_DATABASE`. Normal play and evaluation keep SDK tracing disabled unless the explicit private-development trace controls are enabled together.

The 2026-09-05 [official OpenAI model catalog](https://developers.openai.com/api/docs/models) and [Agents SDK documentation](https://openai.github.io/openai-agents-js/guides/agents/) confirm `gpt-5.6-sol` and the configured reasoning efforts. Provider failures are reduced to safe operational codes such as quota, authentication, access, rate-limit, model, transport, and provider-availability classes; raw provider messages, request IDs, headers, and bodies are never written to eval results. Request IDs appear only in the explicitly invoked private-development smoke diagnostic.

The four paths are a safe no-roll action, a meaningful locked check, forced narration failure after persisted dice, and process restart after persisted dice. Grading uses structured status, stored rolls, and RNG counters rather than prose style.

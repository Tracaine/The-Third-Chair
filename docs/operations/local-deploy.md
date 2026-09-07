# Local container deployment

Prerequisites: Docker Desktop, `private/source-pack.sqlite`, and `OPENAI_API_KEY` in the shell environment.

From the repository root:

```powershell
npm ci
npm test
npm run build
docker compose -f docker/compose.yaml build
docker compose -f docker/compose.yaml up -d
curl.exe -fsS http://127.0.0.1:8787/health
```

The service listens only on `127.0.0.1:8787`. Campaign data and exports live in the ignored `data/` directory. The source pack is mounted read-only and secrets enter only through environment variables.

Use `docker compose -f docker/compose.yaml logs -f third-chair` to follow coded, redacted runtime events. Use `docker compose -f docker/compose.yaml down` to stop it without deleting campaign data.

For a key-free smoke test, set `$env:THIRD_CHAIR_FAKE_MODE='1'` before starting the service. Never use fake mode for a real campaign.

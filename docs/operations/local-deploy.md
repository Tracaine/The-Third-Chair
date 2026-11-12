# Local container deployment

Prerequisites: Docker Desktop, `private/source-pack.sqlite`, and `OPENAI_API_KEY` in the shell environment.

For an existing install, stop the running container or local server, then pull the update and run the [character catalog upgrade](source-pack.md#upgrade-a-pack-already-in-use). Keep your current campaign database and the same bind mount. Run the commands below from the repository root.

```powershell
npm ci
npm run build
npm test
docker compose -f docker/compose.yaml build
docker compose -f docker/compose.yaml up -d
curl.exe -fsS http://127.0.0.1:8787/health
```

The service listens only on `127.0.0.1:8787`. Campaign data and exports live in the ignored `data/` directory. The source pack is mounted read-only and secrets enter only through environment variables.

Use `docker compose -f docker/compose.yaml logs -f third-chair` to follow coded, redacted runtime events. Use `docker compose -f docker/compose.yaml down` to stop it without deleting campaign data.

For a key-free smoke test, set `$env:THIRD_CHAIR_FAKE_MODE='1'` before starting the service. Never use fake mode for a real campaign.

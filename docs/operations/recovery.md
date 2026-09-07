# Recovery runbook

Startup checkpoints and truncates the SQLite WAL before any migration. If a migration fails, the service restores the timestamped `*.pre-migration-*.bak` file and exits without becoming ready.

If `/health` reports `degraded`, inspect only its `recoveryCode`:

- `SOURCE_PACK_UNAVAILABLE`: restore `private/source-pack.sqlite` and restart.
- `SOURCE_PACK_HASH_MISMATCH`: mount the source pack used to create the affected campaign, or restore a matching full-private SaveSet into a new campaign.

In degraded mode, campaigns are projected as `READ_ONLY`. Listing, table view, and player-safe export remain available; campaign mutation is refused.

To restore manually, stop the container, copy the current `data/campaigns.sqlite` aside, then copy the chosen validated pre-migration backup over `data/campaigns.sqlite`. Remove only the adjacent `campaigns.sqlite-wal` and `campaigns.sqlite-shm` files, then restart and check `/health`. Keep the displaced database until the recovered campaign has been opened successfully.

Test corruption recovery only on a disposable copy of `data/`, never on the live campaign database.

# Railway configuration

`.railway/railway.ts` is the desired production configuration for `ducnmm/voi`.
The former `railway.json` settings have been migrated into the API service's
Dockerfile, health-check and restart configuration. Do not manage the same
settings from a second Railway config file.

Use the repository-pinned CLI and SDK:

```sh
pnpm exec railway config plan --out /tmp/voi-production.plan.json
pnpm exec railway config apply --plan /tmp/voi-production.plan.json
```

Review the plan before applying. In agent sessions, applying needs explicit
approval of the exact latest plan. Do not use destructive confirmation flags
without exact approval. A pinned plan prevents applying against changed live
state.

The existing database/Redis services and all three persistent volumes are
retained by name. Volume region and capacity reflect the imported live state;
changing or omitting them can create destructive drift. API uploads stay mounted
at `/app/uploads`. Imported secrets use `preserve()`.

The web service uses a standalone Next.js Docker image and the API's configured
public origin through a typed reference. Railway-generated domains are allocated
operationally and are not hard-coded into the source. Google web OAuth needs the
actual resulting HTTPS origin registered in Google Cloud. Apple web login is
hidden until its Services ID and return URL are configured.

See [the reviewed production plan](../docs/deployment/railway-production-plan.md).

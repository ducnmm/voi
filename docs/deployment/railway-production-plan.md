# Voi web production deployment plan

Target: Railway workspace `ducnmm`, project `voi`, environment `production`.
Source: GitHub `ducnmm/voi`, branch `main`.

## Exact infrastructure changes

1. Add `api.GOOGLE_WEB_CLIENT_ID` for the new Voi Web OAuth client.
2. Move the API's existing Dockerfile, health check and restart settings from
   `railway.json` into `.railway/railway.ts`:
   - Dockerfile: `apps/api/Dockerfile`.
   - Health check: `/health`, 120-second timeout.
   - Restart: on failure, up to five retries.
3. Create `web` from the same GitHub repo/branch:
   - Dockerfile: `apps/web/Dockerfile`.
   - Health check: `/health`, 120-second timeout.
   - `NODE_ENV=production`.
   - API origin references `api.PUBLIC_API_URL`.
   - Google public client ID references `api.GOOGLE_WEB_CLIENT_ID`.

The latest Railway plan reports all four changes as safe and no deletions.
Postgres, Redis, existing API domain, all three volumes and their mounts remain
unchanged. Existing secret values use `preserve()`; no secret is stored in source.

## Deployment after applying the plan

Push the tested source to `main`, deploy API and web, allocate the web's Railway
HTTPS domain, and register that exact origin on the Voi Web Google OAuth client.
The existing Google iOS client and Apple native audience remain supported.
Apple web login stays hidden until a real Apple Services ID is configured.

## Verification before the plan

- 155/155 API tests against a separate local test database.
- 12/12 web unit tests and workspace type checking.
- Both production Docker images built successfully.
- Running web container health: 200; non-root runtime user.
- Running production API container: database healthy, dev login 404, protected
  endpoint without token 401, invalid Google identity token 401.
- Production dependency audit: zero high/critical findings; one moderate issue
  remains in transitive uuid v3/v5/v6 buffer handling, which Voi does not call.

## Verification after deployment

Check both health endpoints, HTTPS/static assets/API/media proxies, real Google
sign-in and logout, access boundaries and chat WebSocket connectivity. Exercise
isolated QA sessions/groups and clean up only the records created by this run.
Review desktop/mobile, light/dark, language, dropdowns and key form/chat flows.

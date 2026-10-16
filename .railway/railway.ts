/**
 * Not the live deploy config — that is /railway.json (Dockerfile builder,
 * /health, restart policy). `railway config apply` of a generated graph can
 * recreate Postgres/Redis and drop the /app/uploads volume. Do not apply.
 */
export {};

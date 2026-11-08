import { defineRailway, github, postgres, preserve, project, redis, service, volume } from "railway/iac";

export default defineRailway(() => {
  const db = postgres("Postgres");
  const cache = redis("Redis");
  const postgresData = volume("postgres-volume", { region: "asia-southeast1-eqsg3a", sizeMB: 50000 });
  const redisData = volume("redis-volume", { region: "asia-southeast1-eqsg3a", sizeMB: 50000 });
  const uploads = volume("api-volume", { region: "asia-southeast1-eqsg3a", sizeMB: 50000 });
  const api = service("api", {
    source: github("ducnmm/voi", { branch: "main" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/api/Dockerfile" },
    healthcheck: "/health",
    healthcheckTimeout: 120,
    // Railway normalizes the default ON_FAILURE policy to null; preserve it.
    deploy: { restartPolicyMaxRetries: 5 },
    env: {
      API_HOST: preserve(), APPLE_BUNDLE_ID: preserve(), APP_BASE_URL: preserve(),
      CORS_ORIGINS: preserve(), DATABASE_URL: preserve(), GOOGLE_IOS_CLIENT_ID: preserve(),
      GOOGLE_WEB_CLIENT_ID: "291960099224-tukj5merv7lpvkrf3cp5dk9rcmbl5c0t.apps.googleusercontent.com",
      JWT_SECRET: preserve(), LOG_LEVEL: preserve(), NODE_ENV: preserve(),
      PUBLIC_API_URL: preserve(), RAILWAY_DOCKERFILE_PATH: preserve(), REDIS_URL: preserve(),
    },
    volumeMounts: { "/app/uploads": uploads },
  });
  const web = service("web", {
    source: github("ducnmm/voi", { branch: "main" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/web/Dockerfile" },
    healthcheck: "/health",
    healthcheckTimeout: 120,
    env: {
      NODE_ENV: "production",
      VOI_API_ORIGIN: api.env.PUBLIC_API_URL,
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: api.env.GOOGLE_WEB_CLIENT_ID,
    },
  });
  return project("voi", { resources: [db, cache, postgresData, redisData, uploads, api, web] });
});

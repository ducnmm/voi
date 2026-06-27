import "dotenv/config";
import { defineConfig } from "vitest/config";

// Integration tests run against a dedicated `voi_test` database derived from the
// dev DATABASE_URL (same host/port, different db name) so they never touch dev
// data. Setting it via `test.env` makes it win over `.env` (dotenv does not
// override already-set process.env vars).
const devUrl =
  process.env.DATABASE_URL ??
  "postgresql://voi:voi@localhost:5432/voi_dev?schema=public";
const testUrl = devUrl.replace("/voi_dev", "/voi_test");

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: testUrl,
      NODE_ENV: "test",
      LOG_LEVEL: "silent"
    },
    // One shared Postgres → run test files sequentially to avoid truncate races.
    fileParallelism: false
  }
});

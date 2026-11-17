import "dotenv/config";
import { defineConfig } from "vitest/config";

// resetDb() truncates tables. Never silently reuse a configured development or
// production database: callers must select a clearly named disposable test DB.
// TEST_DATABASE_URL wins over DATABASE_URL from the developer's .env.
const testUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://voi:voi@localhost:5432/voi_test?schema=public";
const databaseName = decodeURIComponent(new URL(testUrl).pathname.slice(1));
if (!/_test(?:_|$)/i.test(databaseName)) {
  throw new Error(
    "Refusing to run API tests against a non-test database. Set TEST_DATABASE_URL " +
      "to a dedicated database whose name ends in _test or contains _test_."
  );
}

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

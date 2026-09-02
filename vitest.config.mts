import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pure-logic unit tests import modules that construct a PrismaClient at
    // module scope; it never actually connects in these tests, but the
    // constructor requires DATABASE_URL to be set.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      // Force the deterministic MockLLMProvider so tests never hit the
      // network regardless of what's in the developer's shell env.
      OPENAI_API_KEY: "",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

import { describe, expect, it } from "vitest";
import { getAppEnv } from "./env";

describe("getAppEnv", () => {
  it("returns a safe default app name", () => {
    const env = getAppEnv({
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: "test-secret",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/project_management",
    });

    expect(env.APP_NAME).toBe("ProjectFlow");
  });
});

import { describe, expect, it } from "vitest";
import { comparePassword, hashPassword } from "./password";

describe("password helpers", () => {
  it("hashes and validates a password", async () => {
    const password = "StrongP@ssw0rd!";
    const hashed = await hashPassword(password);

    expect(hashed).not.toEqual(password);
    expect(await comparePassword(password, hashed)).toBe(true);
    expect(await comparePassword("wrong-password", hashed)).toBe(false);
  });
});

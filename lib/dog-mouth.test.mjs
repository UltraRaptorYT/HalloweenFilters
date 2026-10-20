import { describe, expect, test } from "bun:test";
import { shouldDogTongueBeOpen } from "./dog-mouth.ts";

describe("Good Dog mouth tracking", () => {
  test("shows the tongue when the mouth opens", () => {
    expect(shouldDogTongueBeOpen(0.3, false)).toBe(true);
  });

  test("keeps the tongue out through small tracking changes", () => {
    expect(shouldDogTongueBeOpen(0.2, true)).toBe(true);
  });

  test("retracts the tongue after the mouth closes", () => {
    expect(shouldDogTongueBeOpen(0.15, true)).toBe(false);
  });
});

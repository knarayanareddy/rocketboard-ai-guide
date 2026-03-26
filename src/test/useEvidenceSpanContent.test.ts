import { describe, it, expect } from "vitest";
import { isUuidLike } from "../hooks/useEvidenceSpanContent";

describe("isUuidLike", () => {
  it("should return true for valid UUIDs", () => {
    // v4
    expect(isUuidLike("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    // lowercase
    expect(isUuidLike("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
    // uppercase
    expect(isUuidLike("F47AC10B-58CC-4372-A567-0E02B2C3D479")).toBe(true);
  });

  it("should return false for stable chunk ids", () => {
    expect(isUuidLike("C00001")).toBe(false);
    expect(isUuidLike("CHUNK_123")).toBe(false);
  });

  it("should return false for malformed UUIDs", () => {
    expect(isUuidLike("550e8400-e29b-41d4-a716")).toBe(false);
    expect(isUuidLike("invalid-uuid-string")).toBe(false);
    expect(isUuidLike("")).toBe(false);
  });
});

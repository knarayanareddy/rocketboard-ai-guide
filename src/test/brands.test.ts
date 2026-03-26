import { describe, it, expect } from "vitest";
import { 
  isUuidString, 
  asChunkPK, 
  asStableChunkId, 
  asChunkRef, 
  asChunkRefLenient 
} from "../types/brands";

describe("Branded Type Parsing & Guards", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
  const STABLE_ID = "C00001";

  describe("isUuidString", () => {
    it("should return true for valid UUIDs", () => {
      expect(isUuidString(VALID_UUID)).toBe(true);
      expect(isUuidString(VALID_UUID.toUpperCase())).toBe(true);
    });

    it("should return false for non-UUID strings", () => {
      expect(isUuidString(STABLE_ID)).toBe(false);
      expect(isUuidString("not-a-uuid")).toBe(false);
      expect(isUuidString("")).toBe(false);
    });
  });

  describe("asChunkPK", () => {
    it("should cast valid UUID to ChunkPK", () => {
      const pk = asChunkPK(VALID_UUID);
      expect(pk).toBe(VALID_UUID);
    });

    it("should throw for invalid UUID", () => {
      expect(() => asChunkPK(STABLE_ID)).toThrow("Invalid ChunkPK");
    });
  });

  describe("asStableChunkId", () => {
    it("should cast non-UUID to StableChunkId", () => {
      const id = asStableChunkId(STABLE_ID);
      expect(id).toBe(STABLE_ID);
    });

    it("should throw for UUID string", () => {
      expect(() => asStableChunkId(VALID_UUID)).toThrow("Invalid StableChunkId");
    });
  });

  describe("asChunkRef", () => {
    it("should cast any valid identifier to ChunkRef", () => {
      expect(asChunkRef(VALID_UUID)).toBe(VALID_UUID);
      expect(asChunkRef(STABLE_ID)).toBe(STABLE_ID);
    });

    it("should throw for obviously invalid strings", () => {
      // Must contain a hyphen but not be a UUID to fail both checks
      expect(() => asChunkRef("invalid-id-format")).toThrow("Unrecognized identifier format");
    });
  });

  describe("asChunkRefLenient", () => {
    it("should return empty string for null/undefined", () => {
      expect(asChunkRefLenient(null)).toBe("");
      expect(asChunkRefLenient(undefined)).toBe("");
    });

    it("should return valid identifier as is", () => {
      expect(asChunkRefLenient(VALID_UUID)).toBe(VALID_UUID);
      expect(asChunkRefLenient(STABLE_ID)).toBe(STABLE_ID);
    });

    it("should still return invalid string but as ChunkRef (backward compatibility)", () => {
      expect(asChunkRefLenient("invalid")).toBe("invalid");
    });
  });
});

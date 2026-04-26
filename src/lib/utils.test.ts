import { describe, expect, it } from "vitest";
import {
  getPlantBaseNumber,
  plantNumberMatchesPrefix,
  plantNumberMatchesQuery,
} from "@/lib/utils";

describe("getPlantBaseNumber", () => {
  it("returns whole value when no decimal exists", () => {
    expect(getPlantBaseNumber("9382")).toBe("9382");
  });

  it("returns portion before first decimal", () => {
    expect(getPlantBaseNumber("9382.1")).toBe("9382");
    expect(getPlantBaseNumber("9382.1.7")).toBe("9382");
  });

  it("trims incoming values", () => {
    expect(getPlantBaseNumber("  9382.1  ")).toBe("9382");
  });
});

describe("plantNumberMatchesPrefix", () => {
  it("matches by raw prefix on full number", () => {
    expect(plantNumberMatchesPrefix("92", "9200.1")).toBe(true);
    expect(plantNumberMatchesPrefix("92", "1092.1")).toBe(false);
  });
});

describe("plantNumberMatchesQuery", () => {
  it("treats non-decimal query as base-number prefix", () => {
    expect(plantNumberMatchesQuery("9382", "9382.1")).toBe(true);
    expect(plantNumberMatchesQuery("938", "9382.1")).toBe(true);
    expect(plantNumberMatchesQuery("9382", "19382.1")).toBe(false);
  });

  it("treats decimal query as instance prefix", () => {
    expect(plantNumberMatchesQuery("9382.1", "9382.1")).toBe(true);
    expect(plantNumberMatchesQuery("9382.1", "9382.12")).toBe(true);
    expect(plantNumberMatchesQuery("9382.1", "9382.2")).toBe(false);
  });
});

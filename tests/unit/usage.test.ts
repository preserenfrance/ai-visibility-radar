import { describe, expect, it } from "vitest";
import { checkUsageGuard } from "@ai-radar/usage";

describe("usage guard", () => {
  it("allows up to 10 prompts on the free plan", () => {
    expect(
      checkUsageGuard("free", {
        brandCount: 1,
        promptsPerBrand: 10,
        scansThisMonth: 0,
        aiCallsThisMonth: 0
      }).allowed
    ).toBe(true);
    expect(
      checkUsageGuard("free", {
        brandCount: 1,
        promptsPerBrand: 11,
        scansThisMonth: 0,
        aiCallsThisMonth: 0
      }).allowed
    ).toBe(false);
  });

  it("blocks plan limits", () => {
    expect(
      checkUsageGuard("starter", {
        brandCount: 2,
        promptsPerBrand: 25,
        scansThisMonth: 0,
        aiCallsThisMonth: 0
      }).allowed
    ).toBe(false);
  });

  it("allows usage inside the plan", () => {
    expect(
      checkUsageGuard("growth", {
        brandCount: 3,
        promptsPerBrand: 100,
        scansThisMonth: 10,
        aiCallsThisMonth: 1000
      }).allowed
    ).toBe(true);
  });
});

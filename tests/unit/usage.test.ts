import { describe, expect, it } from "vitest";
import { checkUsageGuard } from "@ai-radar/usage";

describe("usage guard", () => {
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

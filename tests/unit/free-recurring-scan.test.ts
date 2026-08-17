import { describe, expect, it } from "vitest";
import {
  FREE_RECURRING_SCAN_REACTIVATION_EMAIL_LIMIT,
  freeRecurringScanCanSendReactivationEmail,
  freeRecurringScanNeedsPortalVisit,
} from "@ai-radar/shared";

describe("free recurring scan inactivity guard", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");

  it("allows a scheduled scan when the portal visit is newer than 14 days", () => {
    expect(
      freeRecurringScanNeedsPortalVisit(
        new Date("2026-07-08T12:00:01.000Z"),
        now,
      ),
    ).toBe(false);
  });

  it("requires a portal visit when the user has been inactive for at least 14 days", () => {
    expect(
      freeRecurringScanNeedsPortalVisit(
        new Date("2026-07-07T12:00:00.000Z"),
        now,
      ),
    ).toBe(true);
  });

  it("requires a portal visit when no activity is known", () => {
    expect(freeRecurringScanNeedsPortalVisit(null, now)).toBe(true);
  });

  it("allows only two reactivation emails before the next portal visit", () => {
    expect(freeRecurringScanCanSendReactivationEmail(0)).toBe(true);
    expect(
      freeRecurringScanCanSendReactivationEmail(
        FREE_RECURRING_SCAN_REACTIVATION_EMAIL_LIMIT - 1,
      ),
    ).toBe(true);
    expect(
      freeRecurringScanCanSendReactivationEmail(
        FREE_RECURRING_SCAN_REACTIVATION_EMAIL_LIMIT,
      ),
    ).toBe(false);
  });
});

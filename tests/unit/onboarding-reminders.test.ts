import { describe, expect, it } from "vitest";
import { onboardingReminderCanSend } from "@/lib/onboarding-reminders";

describe("onboarding reminder frequency guard", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");

  it("does not send during the first day after signup", () => {
    expect(
      onboardingReminderCanSend({
        userCreatedAt: new Date("2026-08-21T00:00:00.000Z"),
        remindersSent: 0,
        now,
      }),
    ).toEqual({ canSend: false, reason: "too_new" });
  });

  it("waits five days between reminders", () => {
    expect(
      onboardingReminderCanSend({
        userCreatedAt: new Date("2026-08-01T00:00:00.000Z"),
        remindersSent: 1,
        lastReminderAt: new Date("2026-08-18T00:00:00.000Z"),
        now,
      }),
    ).toEqual({ canSend: false, reason: "cooldown" });
  });

  it("stops after four sent reminders", () => {
    expect(
      onboardingReminderCanSend({
        userCreatedAt: new Date("2026-08-01T00:00:00.000Z"),
        remindersSent: 4,
        lastReminderAt: new Date("2026-08-01T00:00:00.000Z"),
        now,
      }),
    ).toEqual({ canSend: false, reason: "limit_reached" });
  });

  it("allows a reminder after the cooldown", () => {
    expect(
      onboardingReminderCanSend({
        userCreatedAt: new Date("2026-08-01T00:00:00.000Z"),
        remindersSent: 1,
        lastReminderAt: new Date("2026-08-10T00:00:00.000Z"),
        now,
      }),
    ).toEqual({ canSend: true });
  });
});

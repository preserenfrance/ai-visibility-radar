import { randomBytes } from "node:crypto";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";

export type UserEmailConsentInput = {
  marketingEmailConsent?: boolean;
  scanEmailConsent?: boolean;
};

export type EmailPreferenceType = "marketing" | "scans";

export function emailConsentData(
  input: UserEmailConsentInput,
  existing?: {
    marketingEmailConsentAt?: Date | null;
    scanEmailConsentAt?: Date | null;
  } | null,
) {
  const now = new Date();
  const data: {
    marketingEmailConsent?: boolean;
    marketingEmailConsentAt?: Date | null;
    scanEmailConsent?: boolean;
    scanEmailConsentAt?: Date | null;
  } = {};

  if (typeof input.marketingEmailConsent === "boolean") {
    data.marketingEmailConsent = input.marketingEmailConsent;
    data.marketingEmailConsentAt = input.marketingEmailConsent
      ? (existing?.marketingEmailConsentAt ?? now)
      : null;
  }

  if (typeof input.scanEmailConsent === "boolean") {
    data.scanEmailConsent = input.scanEmailConsent;
    data.scanEmailConsentAt = input.scanEmailConsent
      ? (existing?.scanEmailConsentAt ?? now)
      : null;
  }

  return data;
}

export async function ensureEmailPreferencesToken(userId: string) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailPreferencesToken: true },
  });
  if (existing?.emailPreferencesToken) return existing.emailPreferencesToken;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { emailPreferencesToken: randomBytes(32).toString("base64url") },
        select: { emailPreferencesToken: true },
      });
      if (user.emailPreferencesToken) return user.emailPreferencesToken;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }

  throw new Error("Could not create email preferences token");
}

export function emailPreferencesUrl(token: string, type?: EmailPreferenceType) {
  const params = new URLSearchParams({ token });
  if (type) params.set("type", type);
  return `${getConfig().NEXT_PUBLIC_APP_URL}/unsubscribe?${params.toString()}`;
}

export async function unsubscribeByToken(
  token: string,
  type: EmailPreferenceType,
) {
  const data =
    type === "marketing"
      ? {
          marketingEmailConsent: false,
          marketingEmailConsentAt: null,
        }
      : {
          scanEmailConsent: false,
          scanEmailConsentAt: null,
        };

  return prisma.user.update({
    where: { emailPreferencesToken: token },
    data,
    select: emailPreferencesSelect,
  });
}

export async function updateEmailPreferencesByToken(
  token: string,
  input: Required<UserEmailConsentInput>,
) {
  return prisma.user.update({
    where: { emailPreferencesToken: token },
    data: emailConsentData(input),
    select: emailPreferencesSelect,
  });
}

export async function getEmailPreferencesByToken(token: string) {
  return prisma.user.findUnique({
    where: { emailPreferencesToken: token },
    select: emailPreferencesSelect,
  });
}

export const emailPreferencesSelect = {
  id: true,
  email: true,
  marketingEmailConsent: true,
  scanEmailConsent: true,
} as const;

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

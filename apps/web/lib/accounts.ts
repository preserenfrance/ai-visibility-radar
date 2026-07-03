import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@ai-radar/email";
import { hashPassword, verifyPassword } from "@/lib/password";

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;
const WELCOME_EMAIL_SUBJECT = "Dobrodošli v AI Visibility Radar";
const PASSWORD_RESET_EMAIL_SUBJECT =
  "Ponastavitev gesla za AI Visibility Radar";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/app/dashboard",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return fallback;
  return value;
}

export async function createUserAccount(input: {
  email: string;
  password: string;
  name?: string;
  organizationName?: string;
}) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true },
  });
  if (existing?.passwordHash)
    throw new Error("Conflict: račun s tem emailom že obstaja");

  const passwordHash = await hashPassword(input.password);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: input.name, passwordHash },
        include: { memberships: true },
      })
    : await prisma.user.create({
        data: { email, name: input.name, passwordHash },
        include: { memberships: true },
      });

  if (user.memberships.length === 0) {
    await prisma.organization.create({
      data: {
        name:
          input.organizationName ||
          input.name ||
          email.split("@")[0] ||
          "Moja organizacija",
        memberships: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
    });
  }

  const userWithMemberships = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { memberships: { include: { organization: true } } },
  });

  await sendAccountNotification({
    label: "welcome email",
    subject: WELCOME_EMAIL_SUBJECT,
    send: () =>
      sendWelcomeEmail({
        to: userWithMemberships.email,
        name: userWithMemberships.name,
      }),
  });

  return userWithMemberships;
}

export async function authenticateUser(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { organization: true } } },
  });

  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) throw new Error("Unauthorized: napačen email ali geslo");
  return user;
}

export async function requestPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { sent: true, skipped: false, resetUrl: undefined };

  const token = randomBytes(32).toString("base64url");
  const resetUrl = `${getConfig().NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  let emailResult: { id?: string; skipped?: boolean };
  try {
    emailResult = await sendPasswordResetEmail({
      to: email,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MS / 1000 / 60,
    });
    await recordAccountEmailEvent({
      type: emailResult.skipped ? "queued" : "sent",
      providerId: emailResult.id,
      subject: PASSWORD_RESET_EMAIL_SUBJECT,
    });
  } catch (error) {
    await recordAccountEmailEvent({
      type: "failed",
      subject: PASSWORD_RESET_EMAIL_SUBJECT,
      error,
    });
    throw error;
  }

  return { sent: true, skipped: Boolean(emailResult.skipped), resetUrl };
}

export async function resetPasswordWithToken(token: string, password: string) {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: { gt: new Date() },
    },
  });
  if (!user)
    throw new Error(
      "Bad Request: povezava za ponastavitev gesla ni veljavna ali je potekla",
    );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
  return user;
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function sendAccountNotification(input: {
  label: string;
  subject: string;
  send: () => Promise<{ id?: string; skipped?: boolean }>;
}) {
  try {
    const result = await input.send();
    await recordAccountEmailEvent({
      type: result.skipped ? "queued" : "sent",
      providerId: result.id,
      subject: input.subject,
    });
  } catch (error) {
    await recordAccountEmailEvent({
      type: "failed",
      subject: input.subject,
      error,
    });
    console.warn(`Account ${input.label} failed`, error);
  }
}

async function recordAccountEmailEvent(input: {
  type: "queued" | "sent" | "failed";
  providerId?: string;
  subject: string;
  error?: unknown;
}) {
  try {
    await prisma.emailEvent.create({
      data: {
        type: input.type,
        provider: "resend",
        providerId: input.providerId,
        subject: input.subject,
        errorMessage: input.error ? errorMessage(input.error) : undefined,
      },
    });
  } catch (error) {
    console.warn("Account email event logging failed", error);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

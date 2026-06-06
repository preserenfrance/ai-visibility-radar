import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { sendEmail } from "@ai-radar/email";
import { hashPassword, verifyPassword } from "@/lib/password";

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function safeRedirectPath(value: string | null | undefined, fallback = "/app/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export async function createUserAccount(input: {
  email: string;
  password: string;
  name?: string;
  organizationName?: string;
}) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
  if (existing?.passwordHash) throw new Error("Conflict: račun s tem emailom že obstaja");

  const passwordHash = await hashPassword(input.password);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: input.name, passwordHash },
        include: { memberships: true }
      })
    : await prisma.user.create({
        data: { email, name: input.name, passwordHash },
        include: { memberships: true }
      });

  if (user.memberships.length === 0) {
    await prisma.organization.create({
      data: {
        name: input.organizationName || input.name || email.split("@")[0] || "Moja organizacija",
        memberships: {
          create: {
            userId: user.id,
            role: "owner"
          }
        }
      }
    });
  }

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { memberships: { include: { organization: true } } }
  });
}

export async function authenticateUser(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { organization: true } } }
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
      passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS)
    }
  });

  const emailResult = await sendEmail({
    to: email,
    subject: "Ponastavitev gesla za AI Visibility Radar",
    html: [
      "<p>Pozdravljeni,</p>",
      "<p>Prejeli smo zahtevo za ponastavitev gesla.</p>",
      `<p><a href="${resetUrl}">Kliknite tukaj za nastavitev novega gesla</a>.</p>`,
      "<p>Povezava velja 1 uro. Če zahteve niste oddali vi, lahko to sporočilo ignorirate.</p>"
    ].join("")
  });

  return { sent: true, skipped: Boolean(emailResult.skipped), resetUrl };
}

export async function resetPasswordWithToken(token: string, password: string) {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: { gt: new Date() }
    }
  });
  if (!user) throw new Error("Bad Request: povezava za ponastavitev gesla ni veljavna ali je potekla");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null
    }
  });
  return user;
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

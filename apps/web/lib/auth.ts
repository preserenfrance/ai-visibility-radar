import { cookies } from "next/headers";
import { prisma } from "@ai-radar/db";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "air_session";
const LEGACY_COOKIE_NAME = "air_user_id";
const LAST_SEEN_UPDATE_INTERVAL_MS = 1000 * 60 * 10;

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = readSignedSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });
}

export async function getCurrentUserSummary() {
  const cookieStore = await cookies();
  const userId = readSignedSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: login required");
  return user;
}

export async function setUserSession(userId: string) {
  const cookieStore = await cookies();
  const now = new Date();
  cookieStore.set(COOKIE_NAME, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  cookieStore.delete(LEGACY_COOKIE_NAME);
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: now },
  });
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(LEGACY_COOKIE_NAME);
}

export async function recordCurrentUserPortalVisit(now = new Date()) {
  const cookieStore = await cookies();
  const userId = readSignedSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!userId) return null;

  const staleBefore = new Date(now.getTime() - LAST_SEEN_UPDATE_INTERVAL_MS);
  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: staleBefore } }],
    },
    data: { lastSeenAt: now },
  });

  return userId;
}

export function isAdminEmail(email: string) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.trim().toLowerCase());
}

export function isAdminUser(user: { email: string } | null | undefined) {
  return Boolean(user && isAdminEmail(user.email));
}

export async function requireAdminUser() {
  const user = await requireCurrentUser();
  if (!isAdminUser(user)) throw new Error("Forbidden: admin access required");
  return user;
}

export async function requireOrganizationAccess(organizationId: string) {
  const user = await requireCurrentUser();
  const membership = user.memberships.find(
    (item) => item.organizationId === organizationId,
  );
  if (!membership)
    throw new Error("Forbidden: organization membership required");
  return { user, membership };
}

export async function requireBrandAccess(brandId: string) {
  const user = await requireCurrentUser();
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      organization: { include: { billingSubscription: true } },
      competitors: true,
    },
  });
  if (!brand) throw new Error("Brand not found");
  const membership = user.memberships.find(
    (item) => item.organizationId === brand.organizationId,
  );
  if (!membership)
    throw new Error("Forbidden: organization membership required");
  return { user, membership, brand };
}

export async function requireScanAccess(scanRunId: string) {
  const user = await requireCurrentUser();
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: {
      brand: true,
      promptSet: true,
    },
  });
  if (!scan) throw new Error("Scan not found");
  const membership = user.memberships.find(
    (item) => item.organizationId === scan.brand.organizationId,
  );
  if (!membership)
    throw new Error("Forbidden: organization membership required");
  return { user, membership, scan };
}

function signSession(userId: string) {
  const signature = createHmac("sha256", sessionSecret())
    .update(userId)
    .digest("base64url");
  return `${userId}.${signature}`;
}

function readSignedSession(value?: string) {
  if (!value) return null;
  const [userId, signature] = value.split(".");
  if (!userId || !signature) return null;

  const expected = createHmac("sha256", sessionSecret())
    .update(userId)
    .digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return null;
  return timingSafeEqual(expectedBuffer, signatureBuffer) ? userId : null;
}

function sessionSecret() {
  return (
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.DATABASE_URL ??
    "ai-radar-dev-secret"
  );
}

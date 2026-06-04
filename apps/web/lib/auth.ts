import { cookies } from "next/headers";
import { prisma } from "@ai-radar/db";

const COOKIE_NAME = "air_user_id";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(COOKIE_NAME)?.value;
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          organization: true
        }
      }
    }
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: login required");
  return user;
}

export async function setUserSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireOrganizationAccess(organizationId: string) {
  const user = await requireCurrentUser();
  const membership = user.memberships.find((item) => item.organizationId === organizationId);
  if (!membership) throw new Error("Forbidden: organization membership required");
  return { user, membership };
}

export async function requireBrandAccess(brandId: string) {
  const user = await requireCurrentUser();
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      organization: true,
      competitors: true
    }
  });
  if (!brand) throw new Error("Brand not found");
  const membership = user.memberships.find((item) => item.organizationId === brand.organizationId);
  if (!membership) throw new Error("Forbidden: organization membership required");
  return { user, membership, brand };
}

export async function requireScanAccess(scanRunId: string) {
  const user = await requireCurrentUser();
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: {
      brand: true,
      promptSet: true
    }
  });
  if (!scan) throw new Error("Scan not found");
  const membership = user.memberships.find((item) => item.organizationId === scan.brand.organizationId);
  if (!membership) throw new Error("Forbidden: organization membership required");
  return { user, membership, scan };
}

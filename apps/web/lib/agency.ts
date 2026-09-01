import { Prisma, prisma, type AgencyMembershipRole } from "@ai-radar/db";

export const AGENCY_MANAGER_ROLES: readonly AgencyMembershipRole[] = [
  "owner",
  "admin",
];

export function accessibleBrandWhereForUser(
  userId: string,
): Prisma.BrandWhereInput {
  return {
    OR: [
      {
        organization: {
          memberships: { some: { userId } },
        },
      },
      {
        organization: {
          agency: {
            memberships: { some: { userId } },
          },
        },
      },
    ],
  };
}

export function accessibleOrganizationWhereForUser(
  userId: string,
): Prisma.OrganizationWhereInput {
  return {
    OR: [
      { memberships: { some: { userId } } },
      {
        agency: {
          memberships: { some: { userId } },
        },
      },
    ],
  };
}

export async function userHasAgencyAccess(userId: string) {
  const count = await prisma.agencyMembership.count({ where: { userId } });
  return count > 0;
}

export async function findAgencyClientMembership(
  userId: string,
  organizationId: string,
) {
  return prisma.agencyMembership.findFirst({
    where: {
      userId,
      agency: {
        organizations: { some: { id: organizationId } },
      },
    },
  });
}

export async function findAgencyMembershipForBrand(
  userId: string,
  brandId: string,
) {
  return prisma.agencyMembership.findFirst({
    where: {
      userId,
      agency: {
        organizations: {
          some: {
            brands: { some: { id: brandId } },
          },
        },
      },
    },
  });
}

export async function findAgencyMembershipForScan(
  userId: string,
  scanRunId: string,
) {
  return prisma.agencyMembership.findFirst({
    where: {
      userId,
      agency: {
        organizations: {
          some: {
            brands: {
              some: {
                scanRuns: { some: { id: scanRunId } },
              },
            },
          },
        },
      },
    },
  });
}

export async function requireAgencyMembership(
  userId: string,
  agencyId: string,
  roles?: readonly AgencyMembershipRole[],
) {
  const membership = await prisma.agencyMembership.findUnique({
    where: {
      userId_agencyId: {
        userId,
        agencyId,
      },
    },
    include: { agency: true },
  });

  if (!membership) throw new Error("Forbidden: agency membership required");
  if (roles && !roles.includes(membership.role)) {
    throw new Error("Forbidden: agency admin access required");
  }

  return membership;
}

export async function uniqueAgencySlug(name: string) {
  const base = slugifyAgencyName(name) || "agency";
  for (let index = 0; index < 50; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await prisma.agency.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function slugifyAgencyName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeOptionalText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function normalizeHexColor(
  value: FormDataEntryValue | null,
  fallback: string,
) {
  const normalized = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

import { recordCurrentUserPortalVisit } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await recordCurrentUserPortalVisit();
  return <>{children}</>;
}

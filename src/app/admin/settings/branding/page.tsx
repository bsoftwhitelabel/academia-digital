import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { BrandingForm } from "./BrandingForm";

export default async function BrandingPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  if (!tenant) return null;

  return (
    <BrandingForm
      initial={{
        platformName: tenant.platformName,
        logoUrl: tenant.logoUrl,
        faviconUrl: tenant.faviconUrl,
        primaryColor: tenant.primaryColor,
        accentColor: tenant.accentColor,
        emailFromName: tenant.emailFromName,
        emailFromAddress: tenant.emailFromAddress,
      }}
    />
  );
}

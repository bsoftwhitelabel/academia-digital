import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Sidebar } from "@/components/admin/Sidebar";
import { Topbar } from "@/components/admin/Topbar";
import { AdminMobileNav } from "./AdminMobileNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    !["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)
  ) {
    redirect("/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });

  const adminName =
    [session.user.firstName, (session.user as any).lastName].filter(Boolean).join(" ") ||
    "Admin";

  return (
    <>
      <style>{`
        :root {
          --color-primary: ${tenant?.primaryColor || '#0B2447'};
          --color-accent: ${tenant?.accentColor || '#C9A520'};
        }
      `}</style>
      <div className="flex min-h-screen flex-col bg-[var(--color-surface)] md:flex-row">
        {/* Mobile Topbar */}
        <div className="sticky top-0 z-40 flex h-16 w-full items-center justify-between bg-[var(--color-primary)] px-4 text-white shadow-md md:hidden">
          <AdminMobileNav
            tenantName={tenant?.name || "Academia Digital"}
            tenantLogoUrl={tenant?.logoUrl || null}
            adminName={adminName}
          />
          <div className="flex items-center gap-2 font-bold">
            {tenant?.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt="Logo"
                className="h-8 object-contain"
              />
            ) : (
              <span>{tenant?.name || "Academia Digital"}</span>
            )}
          </div>
          <div className="w-10" />
        </div>

        {/* Desktop Sidebar */}
        <Sidebar 
           tenantName={tenant?.name || "Academia Digital"} 
           tenantLogo={tenant?.logoUrl || null} 
           adminName={adminName} 
        />

        {/* Main Content */}
        <main className="flex-1 min-h-screen md:ml-[240px]">
          <Topbar adminName={adminName} />
          <div className="p-4 md:p-8 max-w-[var(--container_max_width)] mx-auto">{children}</div>
        </main>
      </div>
    </>
  );
}

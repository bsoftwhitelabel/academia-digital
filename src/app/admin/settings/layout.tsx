import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

const TABS = [
  { name: "Branding", href: "/admin/settings/branding", roles: ["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"] },
  { name: "Integrações", href: "/admin/settings/integrations", roles: ["TENANT_ADMIN", "SUPER_ADMIN"] },
  { name: "Auditoria", href: "/admin/settings/audit", roles: ["TENANT_ADMIN", "SUPER_ADMIN"] },
] as const;

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role || "";
  const visible = TABS.filter((t) => t.roles.includes(role as any));

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-2">
        {visible.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-[#0B2447]"
          >
            {t.name}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}

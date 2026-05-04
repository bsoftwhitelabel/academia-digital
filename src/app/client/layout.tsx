import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  FileBadge,
  LogOut,
} from "lucide-react";

const NAV = [
  { name: "Dashboard", href: "/client/dashboard", icon: LayoutDashboard },
  { name: "Formandos", href: "/client/trainees", icon: Users },
  { name: "Documentos", href: "/client/documents", icon: FileBadge },
];

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "CLIENT_HR" && session.user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { clientHrOrg: { include: { tenant: true } } },
  });

  const tenant = user?.clientHrOrg?.tenant;
  const clientOrg = user?.clientHrOrg;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] md:flex-row">
      <div className="sticky top-0 z-40 flex h-16 w-full items-center justify-between bg-[#0B2447] px-4 text-white shadow-md md:hidden">
        <span className="font-bold">{tenant?.name || "Academia Digital"}</span>
        <Link href="/api/auth/signout" className="p-2"><LogOut className="h-5 w-5" /></Link>
      </div>

      <aside className="hidden w-64 flex-col bg-[#0B2447] text-white shadow-xl md:flex">
        <div className="flex h-20 items-center justify-center border-b border-white/10 px-6">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt="Logo" className="max-h-12 object-contain" />
          ) : (
            <span className="text-xl font-bold">{tenant?.name || "Academia Digital"}</span>
          )}
        </div>
        <div className="px-6 py-5 text-sm">
          <p className="text-xs uppercase tracking-wider text-gray-400">Recursos Humanos</p>
          <p className="mt-1 font-semibold">{session.user.firstName}</p>
          <p className="mt-0.5 text-xs text-gray-300">{clientOrg?.name || "—"}</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((n) => (
            <Link key={n.name} href={n.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-white/10">
              <n.icon className="h-5 w-5 text-[#C9A520]" />
              {n.name}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link href="/api/auth/signout"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-red-500/10 hover:text-red-300">
            <LogOut className="h-5 w-5" /> Sair
          </Link>
        </div>
      </aside>

      <main className="flex-1">
        <header className="hidden h-16 items-center justify-end gap-4 bg-white px-8 shadow-sm md:flex">
          <span className="text-sm text-gray-500">{clientOrg?.name}</span>
          <span className="h-5 w-px bg-gray-200" />
          <span className="text-sm font-semibold text-[#0B2447]">{session.user.firstName}</span>
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}

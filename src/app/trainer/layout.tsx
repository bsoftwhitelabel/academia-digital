import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, QrCode, FolderOpen, LogOut } from "lucide-react";
import prisma from "@/lib/prisma";

export default async function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== "TRAINER" && session.user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });

  const navItems = [
    { name: "Minhas Sessões", href: "/trainer/sessions", icon: Calendar },
    { name: "Check-in Rápido", href: "/trainer/checkin", icon: QrCode },
    { name: "Documentação", href: "/trainer/dossier", icon: FolderOpen },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] md:flex-row">
      {/* Mobile Topbar */}
      <div className="sticky top-0 z-50 flex h-16 w-full items-center justify-between bg-[#0B2447] px-4 text-white shadow-md md:hidden">
        <div className="flex items-center gap-2 font-bold">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt="Logo" className="h-8 object-contain" />
          ) : (
            <span>{tenant?.name || "Academia Digital"}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-200">{session.user.firstName}</span>
          <Link href="/api/auth/signout" className="p-2" aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col bg-[#0B2447] text-white shadow-xl md:flex">
        <div className="flex h-20 items-center justify-center border-b border-white/10 px-6">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt="Logo" className="max-h-12 object-contain" />
          ) : (
            <span className="text-xl font-bold">{tenant?.name || "Academia Digital"}</span>
          )}
        </div>

        <div className="px-6 py-6 text-sm text-gray-300">
          Formador, <span className="font-semibold text-white">{session.user.firstName}</span>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-4">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-white/10 hover:text-white"
            >
              <item.icon className="h-5 w-5 text-[#C9A520]" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <Link
            href="/api/auth/signout"
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0">
        {/* Desktop Topbar */}
        <header className="hidden h-20 items-center justify-end bg-white px-8 shadow-sm md:flex">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-[#0B2447]">{session.user.firstName}</span>
          </div>
        </header>

        <div className="p-4 md:p-8">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full border-t border-gray-200 bg-white md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-[#0B2447] hover:text-[#C9A520]"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

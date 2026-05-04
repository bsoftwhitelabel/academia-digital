import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, FileBadge, Home, User, LogOut } from "lucide-react";
import prisma from "@/lib/prisma";
import { BottomNav } from "@/components/trainee/BottomNav";

export default async function TraineeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TRAINEE") {
    redirect("/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });

  const navItems = [
    { name: "Painel", href: "/trainee/dashboard", icon: Home },
    { name: "Meus Cursos", href: "/trainee/courses", icon: BookOpen },
    { name: "Certificados", href: "/trainee/certificates", icon: FileBadge },
    { name: "Perfil", href: "/trainee/profile", icon: User },
  ];

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
        <div className="sticky top-0 z-50 flex h-16 w-full items-center justify-between bg-[var(--color-primary)] px-4 text-white shadow-md md:hidden">
          <div className="flex items-center gap-2 font-bold">
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt="Logo" className="h-8 object-contain" />
            ) : (
              <span>{tenant?.name || "Academia Digital"}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/api/auth/signout" className="p-2 text-white/80 hover:text-white transition-colors">
              <LogOut className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden w-64 flex-col bg-[var(--color-primary)] text-white shadow-xl md:flex">
          <div className="flex h-20 items-center justify-center border-b border-white/10 px-6">
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt="Logo" className="max-h-12 object-contain" />
            ) : (
              <span className="text-xl font-bold">{tenant?.name || "Academia Digital"}</span>
            )}
          </div>

          <div className="px-6 py-6 text-sm text-white/80">
            Olá, <span className="font-semibold text-white">{session.user.firstName}</span>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-4">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-white/10 hover:text-white"
              >
                <item.icon className="h-5 w-5 text-[var(--color-accent)]" />
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/10 p-4">
            <Link
              href="/api/auth/signout"
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 pb-[80px] md:pb-0">
          {/* Desktop Topbar */}
          <header className="hidden h-[64px] items-center justify-end bg-[var(--color-surface-2)] px-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border-b border-[var(--color-border)] md:flex">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-[var(--color-text)]">{session.user.firstName}</span>
            </div>
          </header>

          <div className="p-4 md:p-8 max-w-[var(--container_max_width)] mx-auto">{children}</div>
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>
    </>
  );
}

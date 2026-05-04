"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu,
  LayoutDashboard,
  GraduationCap,
  CalendarRange,
  UserCog,
  Users,
  Building2,
  Inbox,
  Settings,
  LogOut,
} from "lucide-react";

export const ADMIN_NAV_ITEMS = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Cursos", href: "/admin/courses", icon: GraduationCap },
  { name: "Ações de Formação", href: "/admin/actions", icon: CalendarRange },
  { name: "Formadores", href: "/admin/trainers", icon: UserCog },
  { name: "Formandos", href: "/admin/trainees", icon: Users },
  { name: "Entidades Cliente", href: "/admin/clients", icon: Building2 },
  { name: "Inquiries", href: "/admin/inquiries", icon: Inbox },
  { name: "Configurações", href: "/admin/settings", icon: Settings },
] as const;

export function AdminMobileNav({
  tenantName,
  tenantLogoUrl,
  adminName,
}: {
  tenantName: string;
  tenantLogoUrl: string | null;
  adminName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir menu"
            data-testid="admin-mobile-trigger"
            className="text-white hover:bg-white/10"
          />
        }
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="bg-[#0B2447] text-white p-0">
        <SheetHeader className="border-b border-white/10 px-6 py-4">
          <SheetTitle className="text-white">
            {tenantLogoUrl ? (
              <img src={tenantLogoUrl} alt={tenantName} className="max-h-10 object-contain" />
            ) : (
              <span>{tenantName}</span>
            )}
          </SheetTitle>
          <p className="mt-1 text-xs text-gray-300">Olá, {adminName}</p>
        </SheetHeader>
        <nav className="flex-1 space-y-1 px-3 py-3">
          {ADMIN_NAV_ITEMS.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/10"
            >
              <item.icon className="h-5 w-5 text-[#C9A520]" />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

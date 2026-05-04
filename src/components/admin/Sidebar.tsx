"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  GraduationCap,
  Building2,
  Layers,
  BarChart3,
  Settings,
  LogOut,
  School
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Cursos", href: "/admin/courses", icon: BookOpen },
  { name: "Ações de Formação", href: "/admin/actions", icon: Calendar },
  { name: "Formadores", href: "/admin/trainers", icon: Users },
  { name: "Formandos", href: "/admin/trainees", icon: GraduationCap },
  { name: "Entidades", href: "/admin/clients", icon: Building2 },
  { name: "Turmas", href: "/admin/classes", icon: Layers },
  { name: "Relatórios", href: "/admin/reports", icon: BarChart3 },
  { name: "Configurações", href: "/admin/settings", icon: Settings },
];

export function Sidebar({ tenantName, tenantLogo, adminName }: any) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname() || "";

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const widthClass = collapsed ? "w-[64px]" : "w-[240px]";

  return (
    <aside className={`${widthClass} h-screen fixed left-0 top-0 border-r border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col z-50 transition-all duration-300 hidden md:flex`}>
      <div className="h-[80px] border-b border-[var(--color-border)] flex flex-col justify-center px-4 overflow-hidden cursor-pointer" onClick={toggle}>
        <div className="flex items-center gap-3">
          <div className="min-w-8 h-8 bg-[var(--color-primary)] rounded flex items-center justify-center text-white">
             {tenantLogo ? <img src={tenantLogo} alt="Logo" className="h-5 object-contain" /> : <School className="w-4 h-4" />}
          </div>
          {!collapsed && (
            <div className="flex flex-col whitespace-nowrap">
              <span className="text-sm font-bold text-[var(--color-primary)]">Academia Digital</span>
              <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-semibold">{tenantName}</span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 py-4 overflow-y-auto overflow-x-hidden px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 group ${
                isActive
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-l-[3px] border-[var(--color-accent)] font-semibold"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              }`}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 min-w-[20px]" />
              {!collapsed && <span className="text-sm truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[var(--color-border)] mt-auto flex flex-col gap-2">
        {!collapsed && (
           <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-primary)]">
                 {adminName.charAt(0)}
              </div>
              <div className="flex flex-col overflow-hidden">
                 <span className="text-xs font-semibold text-[var(--color-text)] truncate">{adminName}</span>
              </div>
           </div>
        )}
        <Link
          href="/api/auth/signout"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors"
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut className="h-5 w-5 min-w-[20px]" />
          {!collapsed && <span className="text-sm font-medium">Sair</span>}
        </Link>
      </div>
    </aside>
  );
}

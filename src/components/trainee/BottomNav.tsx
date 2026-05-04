"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileBadge, Home, User } from "lucide-react";

const navItems = [
  { name: "Painel", href: "/trainee/dashboard", icon: Home },
  { name: "Cursos", href: "/trainee/courses", icon: BookOpen },
  { name: "Certificados", href: "/trainee/certificates", icon: FileBadge },
  { name: "Perfil", href: "/trainee/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname() || "";

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full border-t border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-[0_-4px_16px_rgba(0,0,0,0.05)] md:hidden">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? "text-[var(--color-primary-light)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <div className={`p-1 rounded-full ${isActive ? "bg-[var(--color-primary-light)]/10" : ""}`}>
               <item.icon className={`h-5 w-5 ${isActive ? "fill-[var(--color-primary-light)]/20" : ""}`} />
            </div>
            <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

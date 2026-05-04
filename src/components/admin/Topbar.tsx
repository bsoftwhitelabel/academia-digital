"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, HelpCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Topbar({ adminName }: { adminName: string }) {
  const pathname = usePathname() || "";
  const pageTitle = pathname.split("/").filter(Boolean).pop()?.toUpperCase() || "DASHBOARD";

  return (
    <header className="h-[64px] sticky top-0 z-40 bg-[var(--color-surface-2)] border-b border-[var(--color-border)] flex items-center justify-between px-8">
      <div className="flex items-center gap-4 flex-1">
         <span className="font-semibold text-[var(--color-primary)] tracking-wide">{pageTitle}</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative hidden md:block w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input 
            type="text" 
            placeholder="Pesquisar..." 
            className="w-full pl-9 pr-4 py-2 bg-[var(--color-surface)] border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-light)]/40 outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button className="relative p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] rounded-full transition-all">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--color-warning)] rounded-full border border-white"></span>
          </button>
        </div>

        <div className="h-8 w-[1px] bg-[var(--color-border)] mx-1"></div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-[var(--color-text)]">{adminName}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Administrador</p>
          </div>
          <Avatar className="h-9 w-9 border border-[var(--color-border)]">
            <AvatarFallback className="bg-[var(--color-primary)] text-white">{adminName.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Send, FileBarChart } from "lucide-react";

export function PlanRowActions({ planId, status }: { planId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/training-plans/${planId}/submit`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Erro ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {(status === "DRAFT" || status === "ACTIVE") && (
        <Button
          size="sm"
          variant="outline"
          onClick={submit}
          disabled={busy}
          data-testid={`submit-plan-${planId}`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1 h-4 w-4" />Submeter</>}
        </Button>
      )}
      <Button asChild size="sm" variant="ghost" title="Orçamento">
        <Link href={`/admin/training-plans/${planId}/budget`}>
          <FileBarChart className="h-4 w-4" />
        </Link>
      </Button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </div>
  );
}

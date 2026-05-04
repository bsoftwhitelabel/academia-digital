"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function StartSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trainer/sessions/${sessionId}/open`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Erro ${res.status}`);
        return;
      }
      router.refresh();
      router.push(`/trainer/sessions/${sessionId}/attendance`);
    } catch {
      setError("Erro de ligação ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        onClick={handleClick}
        disabled={loading}
        size="sm"
        className="bg-[#C9A520] font-semibold text-[#0B2447] hover:bg-[#b08e1a]"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />A iniciar…
          </>
        ) : (
          "Iniciar Sessão"
        )}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

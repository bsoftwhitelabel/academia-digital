"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function CheckInButton({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleCheckIn = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/checkin/${sessionId}`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Ocorreu um erro ao fazer check-in.");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg("Erro de ligação ao servidor.");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Check-in Realizado!</h2>
        <p className="mt-2 text-gray-500">A sua presença foi registada com sucesso.</p>
        <Button asChild className="mt-6 bg-[#0B2447] hover:bg-[#153460]">
          <Link href="/trainee/dashboard">Voltar ao Painel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {status === "error" && (
        <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}
      <Button
        onClick={handleCheckIn}
        disabled={status === "loading"}
        size="lg"
        className="w-full bg-[#C9A520] font-bold text-[#0B2447] hover:bg-[#b08e1a] sm:w-auto px-8"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            A processar...
          </>
        ) : (
          "Confirmar Presença"
        )}
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileArchive, Loader2 } from "lucide-react";

export function ExportButtons({ actionId }: { actionId: string }) {
  const [busy, setBusy] = useState<null | "pdf" | "zip">(null);
  const [error, setError] = useState<string | null>(null);

  const downloadFile = async (kind: "pdf" | "zip") => {
    setBusy(kind);
    setError(null);
    try {
      const url =
        kind === "pdf"
          ? `/api/pdf/${actionId}/DOSSIER_COMPLETO`
          : `/api/pdf/${actionId}/ZIP`;
      const res = await fetch(url);
      if (!res.ok) {
        setError(`Erro ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] || (kind === "pdf" ? "dossier.pdf" : "dossier.zip");
      const a = document.createElement("a");
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch (e: any) {
      setError(e?.message || "Erro de ligação");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button
        onClick={() => downloadFile("pdf")}
        disabled={!!busy}
        className="bg-[#0B2447] hover:bg-[#153460]"
        data-testid="export-dossier-pdf"
      >
        {busy === "pdf" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            A gerar dossier… (10-15s)
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Exportar Dossier Completo (PDF)
          </>
        )}
      </Button>

      <Button
        onClick={() => downloadFile("zip")}
        disabled={!!busy}
        variant="outline"
        data-testid="export-dossier-zip"
      >
        {busy === "zip" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            A criar ZIP…
          </>
        ) : (
          <>
            <FileArchive className="mr-2 h-4 w-4" />
            Exportar separados (ZIP)
          </>
        )}
      </Button>

      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

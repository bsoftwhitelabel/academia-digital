"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, QrCode, X } from "lucide-react";
import QRCode from "qrcode";

type QrPayload = {
  sessionId: string;
  token: string;
  url: string;
  expiresAt: string;
};

export function QRCodeModalTrigger({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2"
        data-testid="qr-trigger"
      >
        <QrCode className="h-4 w-4" />
        Gerar QR Code
      </Button>
      {open && <QRCodeModal sessionId={sessionId} onClose={() => setOpen(false)} />}
    </>
  );
}

function QRCodeModal({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Gerar / obter token na BD
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/checkin/${sessionId}/qr`, {
          method: "POST",
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          if (!cancelled) setError(d.error || `Erro ${res.status}`);
          return;
        }
        const data: QrPayload = await res.json();
        if (cancelled) return;
        setQr(data);

        const img = await QRCode.toDataURL(data.url, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 720,
          color: { dark: "#0B2447", light: "#FFFFFF" },
        });
        if (!cancelled) setImageDataUrl(img);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Erro ao gerar QR");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Fechar com Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 text-white"
      data-testid="qr-modal"
      role="dialog"
      aria-label="QR Code da sessão"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Fechar"
        data-testid="qr-close"
        className="absolute top-4 right-4 text-white hover:bg-white/10"
      >
        <X className="h-6 w-6" />
      </Button>

      {error ? (
        <div className="max-w-md rounded bg-red-900/50 p-4 text-center">
          <p className="font-semibold">Erro ao gerar QR Code</p>
          <p className="mt-2 text-sm text-red-200">{error}</p>
          <Button onClick={onClose} className="mt-4">
            Fechar
          </Button>
        </div>
      ) : !imageDataUrl ? (
        <div className="flex items-center gap-3 text-lg">
          <Loader2 className="h-6 w-6 animate-spin" />A gerar QR Code…
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <img
            src={imageDataUrl}
            alt="QR Code para check-in"
            data-testid="qr-image"
            className="h-[60vmin] w-[60vmin] max-h-[720px] max-w-[720px] rounded-2xl bg-white p-6 shadow-2xl"
          />
          <p className="text-center text-2xl font-semibold tracking-tight md:text-4xl">
            Aponte a câmara para fazer check-in
          </p>
          {qr?.url && (
            <p className="max-w-full break-all text-center text-xs text-white/50">
              {qr.url}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

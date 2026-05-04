"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function SignatureCanvas({
  documentId,
  sessionId,
}: {
  documentId: string;
  sessionId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ajustar o tamanho real vs tamanho de display para não ficar borrado
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);

    padRef.current = new SignaturePad(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(11, 36, 71)", // Navy color
    });

    padRef.current.addEventListener("endStroke", () => {
      setIsEmpty(padRef.current?.isEmpty() ?? true);
    });

    const handleResize = () => {
      // Re-ajusta se a janela redimensionar
      const r = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * r;
      canvas.height = canvas.offsetHeight * r;
      canvas.getContext("2d")?.scale(r, r);
      padRef.current?.clear();
      setIsEmpty(true);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      padRef.current?.off();
    };
  }, []);

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
  };

  const handleConfirm = async () => {
    if (!padRef.current || padRef.current.isEmpty()) return;

    setIsSubmitting(true);
    setErrorMsg("");

    const signatureData = padRef.current.toDataURL("image/png");

    try {
      const res = await fetch(`/api/signature/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData, sessionId }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/trainee/dashboard");
        }, 2000);
      } else {
        setErrorMsg(data.error || "Ocorreu um erro ao guardar a assinatura.");
      }
    } catch (error) {
      setErrorMsg("Erro de ligação ao servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-4 text-xl font-bold text-gray-900">Documento Assinado!</h3>
        <p className="mt-2 text-gray-500">A rederecionar para o painel...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {errorMsg && (
        <div className="rounded bg-red-100 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}
      
      <div className="overflow-hidden rounded-md border border-gray-300 shadow-inner">
        <canvas
          ref={canvasRef}
          className="h-[250px] w-full touch-none md:h-[350px]"
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          Limpar
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isEmpty || isSubmitting}
          className="w-full bg-[#0B2447] text-white hover:bg-[#153460] sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              A enviar...
            </>
          ) : (
            "Confirmar Assinatura"
          )}
        </Button>
      </div>
    </div>
  );
}

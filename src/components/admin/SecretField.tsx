"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const REVEAL_DURATION_MS = 30_000;

export type SecretFieldProps = {
  value: string;
  label: string;
  /** Quanto chars do final mostrar (default 4). */
  visibleSuffixLength?: number;
  /** Função opcional para obter o valor real (se a prop value já estiver mascarada). */
  onReveal?: () => Promise<string>;
};

export function SecretField({
  value,
  label,
  visibleSuffixLength = 4,
  onReveal,
}: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const masked = (() => {
    if (!value) return "";
    const suf = visibleSuffixLength > 0 ? value.slice(-visibleSuffixLength) : "";
    return "•".repeat(Math.max(0, 12)) + suf;
  })();

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const closeDialog = () => {
    setDialogOpen(false);
    setPassword("");
    setError(null);
  };

  const handleReveal = async () => {
    if (!password) {
      setError("Indique a sua password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setError("Password incorrecta.");
        return;
      }
      const real = onReveal ? await onReveal() : value;
      setRevealedValue(real);
      setRevealed(true);
      closeDialog();
      // Auto-ocultar após 30s
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setRevealed(false);
        setRevealedValue(null);
      }, REVEAL_DURATION_MS);
    } catch {
      setError("Erro de ligação.");
    } finally {
      setSubmitting(false);
    }
  };

  const hide = () => {
    setRevealed(false);
    setRevealedValue(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <div className="space-y-1" data-testid="secret-field">
      <Label className="text-xs uppercase tracking-wide text-gray-500">{label}</Label>
      <div className="flex items-center gap-2">
        <code
          className="flex-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm tracking-widest text-gray-700"
          data-testid="secret-value"
          data-revealed={revealed ? "1" : "0"}
        >
          {revealed && revealedValue ? revealedValue : masked}
        </code>
        {revealed ? (
          <Button type="button" variant="outline" size="sm" onClick={hide}>
            <EyeOff className="mr-2 h-4 w-4" /> Ocultar
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            data-testid="secret-reveal"
          >
            <Eye className="mr-2 h-4 w-4" /> Mostrar
          </Button>
        )}
      </div>
      {revealed && (
        <p className="text-xs text-amber-700">
          Visível por 30 segundos. Será ocultado automaticamente.
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(o) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar identidade</DialogTitle>
            <DialogDescription>
              Para revelar este valor, confirme a sua password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              value={password}
              data-testid="secret-pw"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleReveal(); } }}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleReveal} disabled={submitting} data-testid="secret-confirm"
              className="bg-[#0B2447] hover:bg-[#153460]">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

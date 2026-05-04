"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X } from "lucide-react";

export type Branding = {
  platformName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  emailFromName: string | null;
  emailFromAddress: string | null;
};

export function BrandingForm({ initial }: { initial: Branding }) {
  const router = useRouter();
  const [data, setData] = useState<Branding>({
    ...initial,
    primaryColor: initial.primaryColor || "#0B2447",
    accentColor: initial.accentColor || "#C9A520",
    platformName: initial.platformName || "Academia Digital",
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Branding>(k: K, v: Branding[K]) =>
    setData((p) => ({ ...p, [k]: v }));

  const upload = (file: File | null, key: keyof Branding) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setMsg({ type: "err", text: "Imagem máx. 1 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set(key as any, reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/tenant/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg({ type: "err", text: j.error || `Erro ${res.status}` });
        return;
      }
      setMsg({ type: "ok", text: "Branding atualizado." });
      router.refresh();
    } catch {
      setMsg({ type: "err", text: "Erro de ligação." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Branding</h1>
        <p className="text-sm text-gray-600">
          Personalize o aspeto da plataforma e do catálogo público.
        </p>
      </div>

      {msg && (
        <div
          className={`rounded p-3 text-sm border ${msg.type === "ok"
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"}`}
          data-testid="branding-msg"
        >{msg.text}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#0B2447]">Configurar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>Nome da plataforma</Label>
              <Input value={data.platformName ?? ""}
                onChange={(e) => set("platformName", e.target.value)} />
            </div>

            <div>
              <Label>Logo</Label>
              <div className="mt-2 flex items-start gap-4">
                {data.logoUrl ? (
                  <div className="relative">
                    <img src={data.logoUrl} className="h-16 w-32 rounded border bg-white object-contain" />
                    <button onClick={() => set("logoUrl", null)}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-16 w-32 items-center justify-center rounded border border-dashed text-xs text-gray-400">
                    sem logo
                  </div>
                )}
                <input ref={logoRef} hidden type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  data-testid="logo-input"
                  onChange={(e) => upload(e.target.files?.[0] ?? null, "logoUrl")} />
                <Button type="button" variant="outline" onClick={() => logoRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Carregar
                </Button>
              </div>
            </div>

            <div>
              <Label>Favicon</Label>
              <div className="mt-2 flex items-start gap-4">
                {data.faviconUrl ? (
                  <div className="relative">
                    <img src={data.faviconUrl} className="h-10 w-10 rounded border bg-white object-contain" />
                    <button onClick={() => set("faviconUrl", null)}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed text-[10px] text-gray-400">
                    favicon
                  </div>
                )}
                <input ref={faviconRef} hidden type="file" accept="image/png,image/x-icon"
                  onChange={(e) => upload(e.target.files?.[0] ?? null, "faviconUrl")} />
                <Button type="button" variant="outline" onClick={() => faviconRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Carregar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cor primária</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={data.primaryColor ?? "#0B2447"}
                    onChange={(e) => set("primaryColor", e.target.value)}
                    className="h-10 w-12 rounded border" />
                  <Input value={data.primaryColor ?? ""}
                    onChange={(e) => set("primaryColor", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Cor de destaque</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={data.accentColor ?? "#C9A520"}
                    onChange={(e) => set("accentColor", e.target.value)}
                    className="h-10 w-12 rounded border" />
                  <Input value={data.accentColor ?? ""}
                    onChange={(e) => set("accentColor", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Email — nome do remetente</Label>
                <Input value={data.emailFromName ?? ""}
                  onChange={(e) => set("emailFromName", e.target.value)} />
              </div>
              <div>
                <Label>Email — endereço</Label>
                <Input type="email" value={data.emailFromAddress ?? ""}
                  onChange={(e) => set("emailFromAddress", e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={submit} disabled={submitting}
                className="bg-[#0B2447] hover:bg-[#153460]"
                data-testid="branding-save">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#0B2447]">Preview ao vivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border" data-testid="branding-preview">
              <div
                className="flex items-center gap-3 px-4 py-4"
                style={{ background: data.primaryColor || "#0B2447" }}
              >
                {data.logoUrl ? (
                  <img src={data.logoUrl} className="h-10 max-w-[160px] object-contain" alt="logo" />
                ) : (
                  <span className="text-lg font-bold text-white">
                    {data.platformName || "Academia Digital"}
                  </span>
                )}
              </div>
              <div className="space-y-3 bg-[#F7F8FA] p-4">
                <h3 className="text-base font-bold" style={{ color: data.primaryColor || "#0B2447" }}>
                  Catálogo de Formação
                </h3>
                <div className="rounded border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide" style={{ color: data.accentColor || "#C9A520" }}>
                    Em destaque
                  </div>
                  <div className="mt-1 font-semibold text-gray-900">Curso de Liderança</div>
                  <button
                    className="mt-3 rounded px-3 py-1.5 text-sm text-white"
                    style={{ background: data.accentColor || "#C9A520" }}
                  >
                    Tenho Interesse
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, X } from "lucide-react";

type Area = { id: string; name: string };

export type CourseDraft = {
  id?: string;
  name: string;
  sigla?: string | null;
  code?: string | null;
  durationHours?: number | string;
  format: "PRESENCIAL" | "ELEARNING" | "BLENDED";
  areaId?: string | null;
  shortDescription?: string;
  fullDescription?: string;
  objectives?: string;
  targetAudience?: string;
  methodology?: string;
  evaluationMethod?: string;
  coverImageUrl?: string | null;
  price?: number | string | null;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  status: "DRAFT" | "PUBLISHED" | "FEATURED" | "ARCHIVED";
};

export function CourseForm({
  initial,
  areas,
  isNew,
}: {
  initial: CourseDraft;
  areas: Area[];
  isNew: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<CourseDraft>(initial);
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CourseDraft>(k: K, v: CourseDraft[K]) =>
    setData((p) => ({ ...p, [k]: v }));

  const handleImage = (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Imagem máx. 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("coverImageUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async (publish: boolean) => {
    setError(null);
    if (!data.name?.trim()) {
      setError("Nome obrigatório.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        durationHours: data.durationHours ? Number(data.durationHours) : 0,
        price: data.price === "" || data.price == null ? null : Number(data.price),
        tags: data.tags ?? [],
        status: publish ? "PUBLISHED" : data.status,
      };
      const res = isNew
        ? await fetch(`/api/admin/courses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/courses/${data.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Erro ${res.status}`);
        return;
      }
      router.push("/admin/courses");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Erro ao guardar.");
    } finally {
      setSubmitting(false);
    }
  };

  const tags = data.tags ?? [];
  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) set("tags", [...tags, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => set("tags", tags.filter((x) => x !== t));

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">
          {isNew ? "Novo Curso" : "Editar Curso"}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => submit(false)}
            data-testid="save-draft"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
          <Button
            disabled={submitting}
            onClick={() => submit(true)}
            className="bg-[#0B2447] hover:bg-[#153460]"
            data-testid="save-publish"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar e Publicar
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="info">Informação Geral</TabsTrigger>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#0B2447]">Identificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome <span className="text-red-500">*</span></Label>
                <Input id="name" data-testid="f-name" value={data.name}
                  onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="sigla">Sigla</Label>
                  <Input id="sigla" value={data.sigla ?? ""} onChange={(e) => set("sigla", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="code">Código</Label>
                  <Input id="code" value={data.code ?? ""} onChange={(e) => set("code", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="duration">Duração (horas) <span className="text-red-500">*</span></Label>
                  <Input id="duration" type="number" data-testid="f-duration"
                    value={data.durationHours ?? ""}
                    onChange={(e) => set("durationHours", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="area">Área de Formação</Label>
                  <select
                    id="area"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    value={data.areaId ?? ""}
                    onChange={(e) => set("areaId", e.target.value || null)}
                  >
                    <option value="">— sem área —</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="format">Modalidade <span className="text-red-500">*</span></Label>
                  <select
                    id="format"
                    data-testid="f-format"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    value={data.format}
                    onChange={(e) => set("format", e.target.value as any)}
                  >
                    <option value="PRESENCIAL">Presencial</option>
                    <option value="ELEARNING">E-learning</option>
                    <option value="BLENDED">Blended</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#0B2447]">Conteúdo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="short">Descrição curta (máx. 200)</Label>
                <Textarea id="short" rows={2} maxLength={200}
                  value={data.shortDescription ?? ""}
                  onChange={(e) => set("shortDescription", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="full">Descrição completa</Label>
                <Textarea id="full" rows={5}
                  value={data.fullDescription ?? ""}
                  onChange={(e) => set("fullDescription", e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="obj">Objetivos</Label>
                  <Textarea id="obj" rows={3}
                    value={data.objectives ?? ""}
                    onChange={(e) => set("objectives", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="target">Destinatários</Label>
                  <Textarea id="target" rows={3}
                    value={data.targetAudience ?? ""}
                    onChange={(e) => set("targetAudience", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="meth">Metodologia</Label>
                  <Textarea id="meth" rows={3}
                    value={data.methodology ?? ""}
                    onChange={(e) => set("methodology", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="eval">Avaliação</Label>
                  <Textarea id="eval" rows={3}
                    value={data.evaluationMethod ?? ""}
                    onChange={(e) => set("evaluationMethod", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalog">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#0B2447]">Catálogo & SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Imagem de capa</Label>
                <div className="mt-2 flex items-start gap-4">
                  {data.coverImageUrl ? (
                    <div className="relative">
                      <img src={data.coverImageUrl} alt="Capa" className="h-24 w-40 rounded border object-cover" />
                      <button
                        type="button"
                        onClick={() => set("coverImageUrl", null)}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"
                      ><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <div className="flex h-24 w-40 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-400">
                      sem capa
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      ref={fileInputRef}
                      data-testid="f-cover"
                      className="hidden"
                      onChange={(e) => handleImage(e.target.files?.[0] ?? null)}
                    />
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> Carregar imagem
                    </Button>
                    <p className="mt-2 text-xs text-gray-500">PNG/JPG/WebP até 2 MB. Em dev, guardada como base64.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="price">Preço (€)</Label>
                  <Input id="price" type="number" step="0.01"
                    value={data.price ?? ""}
                    onChange={(e) => set("price", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="status">Estado</Label>
                  <select
                    id="status"
                    data-testid="f-status"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    value={data.status}
                    onChange={(e) => set("status", e.target.value as any)}
                  >
                    <option value="DRAFT">Rascunho</option>
                    <option value="PUBLISHED">Publicado</option>
                    <option value="FEATURED">Em Destaque</option>
                    <option value="ARCHIVED">Arquivado</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Tags</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                      {t}
                      <button onClick={() => removeTag(t)} className="text-red-500"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Nova tag…"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>Adicionar</Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="featured"
                  checked={data.status === "FEATURED"}
                  onCheckedChange={(v) => set("status", v ? "FEATURED" : "PUBLISHED")}
                />
                <Label htmlFor="featured">Em Destaque (mostra no topo do catálogo)</Label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="seo-t">SEO — Título</Label>
                  <Input id="seo-t" value={data.seoTitle ?? ""}
                    onChange={(e) => set("seoTitle", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="seo-d">SEO — Descrição</Label>
                  <Input id="seo-d" value={data.seoDescription ?? ""}
                    onChange={(e) => set("seoDescription", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

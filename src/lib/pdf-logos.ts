import prisma from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";

export type LogoSet = {
  tenant: string | null;
  client: string | null;
  dgert: string | null;
};

const TEN_MINUTES_MS = 10 * 60 * 1000;

type CacheEntry = { value: LogoSet; expiresAt: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(tenantId: string, clientOrgId?: string | null): string {
  return `${tenantId}::${clientOrgId ?? "none"}`;
}

function mimeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

/**
 * Devolve uma data-URL para um logo dado:
 * - data: URL → passa-through
 * - http(s) URL → fetch + base64
 * - falha (404, timeout, URL inválida) → null
 */
async function urlToDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 5 * 1024 * 1024) return null;
    const mime = res.headers.get("content-type") || mimeFromUrl(url);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

let _dgertCached: { value: string | null; loaded: boolean } = {
  value: null,
  loaded: false,
};

async function getDgertLogo(): Promise<string | null> {
  if (_dgertCached.loaded) return _dgertCached.value;
  try {
    const filePath = path.join(process.cwd(), "public", "dgert-logo.png");
    const buf = await fs.readFile(filePath);
    const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    _dgertCached = { value: dataUrl, loaded: true };
    return dataUrl;
  } catch {
    _dgertCached = { value: null, loaded: true };
    return null;
  }
}

/**
 * Busca os 3 logos (Tenant, ClientOrg, DGERT) e devolve-os como data-URLs.
 * Cache em memória (10 min) por par (tenantId, clientOrgId).
 */
export async function getLogosAsBase64(
  tenantId: string,
  clientOrgId?: string | null
): Promise<LogoSet> {
  const key = cacheKey(tenantId, clientOrgId);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { logoUrl: true, dgertLogoUrl: true },
  });
  const clientOrg = clientOrgId
    ? await prisma.clientOrg.findUnique({
        where: { id: clientOrgId },
        select: { logoUrl: true },
      })
    : null;

  const [tenantData, clientData, dgertOverride, dgertLocal] = await Promise.all([
    urlToDataUrl(tenant?.logoUrl ?? null),
    urlToDataUrl(clientOrg?.logoUrl ?? null),
    urlToDataUrl(tenant?.dgertLogoUrl ?? null),
    getDgertLogo(),
  ]);

  const value: LogoSet = {
    tenant: tenantData,
    client: clientData,
    // Preferir o override do tenant; senão usar o ficheiro local em public/
    dgert: dgertOverride ?? dgertLocal,
  };

  cache.set(key, { value, expiresAt: now + TEN_MINUTES_MS });
  return value;
}

// Para uso em testes
export function _clearLogoCache() {
  cache.clear();
  _dgertCached = { value: null, loaded: false };
}

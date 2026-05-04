// Helpers e cabeçalho partilhados por todos os 23 templates DGERT.
// Cada template `render*` retorna uma string HTML que o Puppeteer transforma em PDF.

import type { LogoSet } from "../index";

export function esc(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mn = String(date.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mn}`;
}

export function logoBlock(
  logo: string | null,
  fallbackName: string,
  align: "left" | "center" | "right"
): string {
  if (logo) {
    const ml = align === "left" ? "0" : "auto";
    const mr = align === "right" ? "0" : "auto";
    return `<img src="${esc(logo)}" alt="${esc(fallbackName)}" style="max-height:48px;max-width:160px;object-fit:contain;display:block;margin-left:${ml};margin-right:${mr};" />`;
  }
  return `<div style="font-size:10px;color:#666;border:1px dashed #bbb;padding:6px 10px;display:inline-block;">${esc(fallbackName)}</div>`;
}

export function renderHeader(
  logos: LogoSet,
  tenantName: string,
  clientName: string | null,
  subtitle?: string | null,
  docCode?: string | null
): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tr>
        <td style="width:33%;text-align:left;vertical-align:middle;padding-bottom:6px;">
          ${logoBlock(logos.client, clientName || "Entidade Cliente", "left")}
        </td>
        <td style="width:34%;text-align:center;vertical-align:middle;padding-bottom:6px;">
          ${logoBlock(logos.tenant, tenantName, "center")}
        </td>
        <td style="width:33%;text-align:right;vertical-align:middle;padding-bottom:6px;">
          ${logoBlock(logos.dgert, "DGERT", "right")}
        </td>
      </tr>
    </table>
    <div style="border-top:2px solid #0B2447;margin:0 0 12px;"></div>
    ${
      subtitle
        ? `<div style="text-align:center;margin-bottom:12px;">
             <h1 style="color:#0B2447;font-size:16px;letter-spacing:0.6px;margin:0;text-transform:uppercase;">${esc(subtitle)}</h1>
             ${docCode ? `<div style="font-size:9px;color:#888;margin-top:2px;">DGERT — Doc ${esc(docCode)}</div>` : ""}
           </div>`
        : ""
    }
  `;
}

export const baseCss = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    margin: 0;
    padding: 14px 18px;
    font-size: 10px;
  }
  h2 {
    color: #0B2447;
    font-size: 12px;
    margin: 14px 0 6px;
    border-bottom: 1px solid #C9A520;
    padding-bottom: 3px;
  }
  table.meta {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 10px;
  }
  table.meta td {
    padding: 4px 8px;
    border: 1px solid #e0e0e0;
    vertical-align: top;
  }
  table.meta td.lbl {
    background: #F7F8FA;
    color: #555;
    font-weight: 600;
    width: 18%;
  }
  table.data {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
  }
  table.data th {
    border: 1px solid #ddd;
    padding: 4px 6px;
    background: #0B2447;
    color: #fff;
    font-size: 9px;
    text-align: left;
  }
  table.data td {
    border: 1px solid #ddd;
    padding: 4px 6px;
    font-size: 10px;
    vertical-align: top;
  }
  .signature-area {
    margin-top: 16px;
    display: table;
    width: 100%;
  }
  .signature-area .cell {
    display: table-cell;
    width: 50%;
    vertical-align: top;
    padding: 0 8px;
  }
  .signature-area .label {
    font-size: 9px;
    font-weight: 600;
    color: #0B2447;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 6px;
  }
  .signature-area .area {
    height: 50px;
    border-bottom: 1px solid #999;
  }
  .signature-area img.sig {
    max-height: 46px;
    max-width: 200px;
  }
  .small { font-size: 9px; color: #666; }
  .accent { color: #C9A520; }
  .empty-line {
    display: inline-block;
    border-bottom: 1px solid #999;
    min-width: 200px;
    height: 14px;
  }
`;

export function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>${baseCss}</style>
</head>
<body>${body}</body>
</html>`;
}

/** Procura `DocumentSignature` SIGNED por documentType+traineeId (ou trainerId). */
export function findSignature(
  signatures: any[] | undefined,
  documentType: string
): string | null {
  if (!signatures) return null;
  const s = signatures.find(
    (x: any) => x.documentType === documentType && x.status === "SIGNED" && x.signatureUrl
  );
  return s?.signatureUrl || null;
}

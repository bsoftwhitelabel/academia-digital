import type { ActionPDFData, LogoSet } from "./index";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  // UTC components — datas guardadas como midnight UTC não devem desvariar por TZ.
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function logoBlock(logo: string | null, fallbackName: string, align: "left" | "center" | "right"): string {
  if (logo) {
    return `<img src="${esc(logo)}" alt="${esc(fallbackName)}" style="max-height:48px;max-width:160px;object-fit:contain;display:block;margin-${align === "left" ? "right" : align === "right" ? "left" : "left"}:auto;margin-${align === "left" ? "left" : align === "right" ? "right" : "right"}:auto;" />`;
  }
  return `<div style="font-size:10px;color:#666;border:1px dashed #bbb;padding:6px 10px;display:inline-block;">${esc(fallbackName)}</div>`;
}

function header3Logos(logos: LogoSet, tenantName: string, clientName: string | null): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <td style="width:33%;text-align:left;vertical-align:middle;">
          ${logoBlock(logos.client, clientName || "Entidade Cliente", "left")}
        </td>
        <td style="width:34%;text-align:center;vertical-align:middle;">
          ${logoBlock(logos.tenant, tenantName, "center")}
        </td>
        <td style="width:33%;text-align:right;vertical-align:middle;">
          ${logoBlock(logos.dgert, "DGERT", "right")}
        </td>
      </tr>
    </table>
  `;
}

export function renderFolhaPresencas(data: ActionPDFData): string {
  const { action, tenant, trainees, logos } = data;
  const sessions = (action.sessions || []) as any[];
  const sessionCount = sessions.length;

  // Mapa rápido: traineeId → set de sessionIds com check-in
  const presenceMap = new Map<string, Set<string>>();
  for (const t of trainees) {
    const sids = new Set<string>(
      (t.checkIns || [])
        .filter((c: any) => c.status !== "ABSENT")
        .map((c: any) => c.sessionId)
    );
    presenceMap.set(t.id, sids);
  }

  // Mapa: traineeId → DocumentSignature SIGNED de REGISTO_PRESENCAS (data URL)
  const signedMap = new Map<string, string>();
  for (const t of trainees) {
    const sig = (t.signatures || []).find(
      (s: any) =>
        s.documentType === "REGISTO_PRESENCAS" &&
        s.status === "SIGNED" &&
        s.signatureUrl
    );
    if (sig) signedMap.set(t.id, sig.signatureUrl);
  }

  // Assinatura do formador: usar da última sessão que tenha
  const trainerSignedSession = [...sessions]
    .reverse()
    .find((s) => s.trainerSignatureUrl);
  const trainerSignatureUrl: string | null =
    trainerSignedSession?.trainerSignatureUrl || null;
  const trainerSignedAt: Date | null = trainerSignedSession?.trainerSignedAt
    ? new Date(trainerSignedSession.trainerSignedAt)
    : null;

  const trainerNames =
    (action.trainers || [])
      .map(
        (t: any) =>
          `${t.trainer?.user?.firstName || ""} ${t.trainer?.user?.lastName || ""}`.trim()
      )
      .filter(Boolean)
      .join(", ") || "—";

  const localLine =
    action.room?.name ||
    (action.format === "ELEARNING" ? "E-learning" : "Sem sala definida");

  const courseArea = action.course?.area?.name || "—";

  const sessionHeaders = sessions
    .map(
      (s: any, i: number) => `
      <th style="border:1px solid #ddd;padding:4px;background:#0B2447;color:#fff;font-size:9px;">
        S${i + 1}<br/><span style="font-weight:400;font-size:8px;">${esc(fmtDate(s.sessionDate))}</span>
      </th>`
    )
    .join("");

  const rows = trainees
    .map((t: any, idx: number) => {
      const present = presenceMap.get(t.id) ?? new Set<string>();
      const sigUrl = signedMap.get(t.id);
      const cells = sessions
        .map((s: any) => {
          const isPresent = present.has(s.id);
          return `<td style="border:1px solid #ddd;padding:4px;text-align:center;font-weight:600;">${
            isPresent ? "P" : '<span style="display:inline-block;width:24px;border-bottom:1px solid #999;"></span>'
          }</td>`;
        })
        .join("");

      const sigCell = sigUrl
        ? `<td style="border:1px solid #ddd;padding:2px;text-align:center;width:140px;">
             <img src="${esc(sigUrl)}" alt="Assinatura" style="max-height:36px;max-width:130px;display:inline-block;" />
           </td>`
        : `<td style="border:1px solid #ddd;padding:2px;width:140px;">
             <div style="border-bottom:1px solid #999;height:30px;"></div>
           </td>`;

      const fullName = `${esc(t.firstName)} ${esc(t.lastName)}`.trim();

      return `
        <tr>
          <td style="border:1px solid #ddd;padding:4px;text-align:center;font-size:9px;">${idx + 1}</td>
          <td style="border:1px solid #ddd;padding:4px;font-size:10px;">${fullName}</td>
          <td style="border:1px solid #ddd;padding:4px;font-size:9px;font-family:monospace;">${esc(t.nif || "—")}</td>
          ${cells}
          ${sigCell}
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>Folha de Presenças — ${esc(action.actionCode || action.id)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    margin: 0;
    padding: 14px 18px;
    font-size: 10px;
  }
  h1 {
    color: #0B2447;
    font-size: 16px;
    margin: 6px 0 4px;
    text-align: center;
    letter-spacing: 0.5px;
  }
  h2 {
    color: #0B2447;
    font-size: 11px;
    margin: 10px 0 4px;
  }
  .meta {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;
    font-size: 10px;
  }
  .meta td {
    padding: 4px 8px;
    border: 1px solid #e0e0e0;
  }
  .meta .lbl {
    background: #F7F8FA;
    color: #555;
    font-weight: 600;
    width: 14%;
  }
  table.attendance {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
  }
  table.attendance th {
    border: 1px solid #ddd;
    padding: 4px;
    background: #0B2447;
    color: #fff;
    font-size: 9px;
    text-align: center;
  }
  table.attendance td {
    border: 1px solid #ddd;
    padding: 4px;
    font-size: 10px;
  }
  .footer {
    margin-top: 18px;
    border-top: 2px solid #0B2447;
    padding-top: 10px;
    display: table;
    width: 100%;
  }
  .footer .cell {
    display: table-cell;
    width: 50%;
    vertical-align: top;
  }
  .footer .label {
    font-size: 10px;
    font-weight: 600;
    color: #0B2447;
    margin-bottom: 6px;
  }
  .footer .sig-area {
    height: 60px;
    border-bottom: 1px solid #999;
    position: relative;
  }
  .footer img.sig {
    max-height: 56px;
    max-width: 220px;
  }
  .small { font-size: 9px; color: #666; }
  .accent { color: #C9A520; }
</style>
</head>
<body>
  ${header3Logos(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null)}

  <h1>REGISTO DE PRESENÇAS</h1>

  <table class="meta">
    <tr>
      <td class="lbl">Curso</td>
      <td colspan="3">${esc(action.course?.name || "—")}</td>
    </tr>
    <tr>
      <td class="lbl">Código da Ação</td>
      <td>${esc(action.actionCode || action.actionNumber || "—")}</td>
      <td class="lbl">Modalidade</td>
      <td>${esc(action.format || "—")}</td>
    </tr>
    <tr>
      <td class="lbl">Datas</td>
      <td>${esc(fmtDate(action.startDate))} a ${esc(fmtDate(action.endDate))}</td>
      <td class="lbl">Local</td>
      <td>${esc(localLine)}</td>
    </tr>
    <tr>
      <td class="lbl">Formador</td>
      <td>${esc(trainerNames)}</td>
      <td class="lbl">Área DGERT</td>
      <td>${esc(courseArea)}</td>
    </tr>
    <tr>
      <td class="lbl">Cliente</td>
      <td>${esc(action.clientOrg?.name || "—")}</td>
      <td class="lbl">Duração</td>
      <td>${esc(action.course?.durationHours ?? "—")} h</td>
    </tr>
  </table>

  <table class="attendance">
    <thead>
      <tr>
        <th style="width:24px;">Nº</th>
        <th style="text-align:left;padding-left:6px;">Nome do Formando</th>
        <th style="width:80px;">NIF</th>
        ${sessionHeaders || `<th>Sessão</th>`}
        <th style="width:140px;">Assinatura</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${4 + Math.max(sessionCount, 1)}" style="border:1px solid #ddd;padding:10px;text-align:center;color:#999;">Sem formandos inscritos.</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    <div class="cell">
      <div class="label">Assinatura do Formador:</div>
      <div class="sig-area">
        ${
          trainerSignatureUrl
            ? `<img class="sig" src="${esc(trainerSignatureUrl)}" alt="Assinatura do formador" />`
            : ""
        }
      </div>
      <div class="small">${esc(trainerNames)}${
        trainerSignedAt ? ` · Assinado a ${esc(fmtDate(trainerSignedAt))}` : ""
      }</div>
    </div>
    <div class="cell" style="padding-left:14px;">
      <div class="label">Observações:</div>
      <div style="height:60px;border:1px solid #e0e0e0;border-radius:4px;"></div>
      <div class="small accent">P = Presente · linha em branco = Ausente</div>
    </div>
  </div>
</body>
</html>`;
}

export const folhaPresencasMeta = { landscape: true };

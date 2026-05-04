import type { CertificatePDFData, LogoSet } from "./index";

function esc(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
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
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtDateLong(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${date.getUTCDate()} de ${months[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

export type CertificatePDFDataWithQR = CertificatePDFData & {
  qrDataUrl?: string | null;
  verifyUrl?: string | null;
};

export function renderCertificado(data: CertificatePDFDataWithQR): string {
  const { trainee, course, action, certificate, tenant, logos, qrDataUrl, verifyUrl } = data;

  const fullName = `${esc(trainee?.firstName)} ${esc(trainee?.lastName)}`.trim();
  const courseName = course?.name || certificate?.courseName || "—";
  const durationHours = course?.durationHours ?? certificate?.durationHours ?? "—";
  const startDate = action?.startDate ?? certificate?.startedAt;
  const endDate = action?.endDate ?? certificate?.completedAt;
  const issueDate = certificate?.issuedAt ?? new Date();
  const verifyCode = certificate?.verificationCode ?? "—";

  const localCity =
    action?.room?.city ||
    tenant?.city ||
    "Porto";

  const tenantLogo = logos?.tenant
    ? `<img src="${esc(logos.tenant)}" alt="${esc(tenant?.name || "")}" style="max-height:90px;max-width:340px;object-fit:contain;" />`
    : `<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:36px;font-weight:700;color:#0B2447;letter-spacing:1.5px;">${esc(tenant?.name || "Academia Digital")}</div>`;

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>Certificado de Conclusão — ${fullName}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4 landscape; margin: 0; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: "Garamond", "Cormorant Garamond", "Georgia", "Times New Roman", serif;
    color: #0B2447;
    background: #ffffff;
  }
  .page {
    width: 297mm;
    height: 210mm;
    padding: 14mm;
    position: relative;
    background: #ffffff;
  }
  .frame {
    position: absolute;
    inset: 14mm;
    border: 2px solid #0B2447;
    pointer-events: none;
  }
  .frame::before {
    content: "";
    position: absolute;
    inset: 4mm;
    border: 1px solid #C9A520;
  }
  .corner {
    position: absolute;
    width: 28mm;
    height: 28mm;
    pointer-events: none;
  }
  .corner.tl { top: 16mm; left: 16mm;
    border-top: 4px solid #C9A520; border-left: 4px solid #C9A520; }
  .corner.tr { top: 16mm; right: 16mm;
    border-top: 4px solid #C9A520; border-right: 4px solid #C9A520; }
  .corner.bl { bottom: 16mm; left: 16mm;
    border-bottom: 4px solid #C9A520; border-left: 4px solid #C9A520; }
  .corner.br { bottom: 16mm; right: 16mm;
    border-bottom: 4px solid #C9A520; border-right: 4px solid #C9A520; }
  .content {
    position: relative;
    z-index: 1;
    height: 100%;
    padding: 18mm 22mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .logo-wrap {
    margin-top: 4mm;
    margin-bottom: 4mm;
  }
  h1 {
    font-family: "Cormorant Garamond", "Garamond", "Georgia", serif;
    font-size: 44pt;
    font-weight: 700;
    letter-spacing: 6px;
    color: #0B2447;
    margin: 8mm 0 4mm;
    text-transform: uppercase;
  }
  .underline {
    width: 60mm;
    height: 2px;
    background: #C9A520;
    margin: 0 auto 6mm;
  }
  .lead {
    font-size: 14pt;
    color: #444;
    letter-spacing: 0.4px;
    margin: 0 0 4mm;
  }
  .name {
    font-family: "Cormorant Garamond", "Garamond", "Georgia", serif;
    font-size: 32pt;
    font-style: italic;
    font-weight: 600;
    color: #0B2447;
    margin: 2mm 0 4mm;
    border-bottom: 1px solid #C9A520;
    padding-bottom: 2mm;
    min-width: 160mm;
  }
  .body {
    font-size: 13pt;
    color: #333;
    line-height: 1.55;
    max-width: 200mm;
  }
  .body .course {
    font-family: "Cormorant Garamond", "Garamond", "Georgia", serif;
    font-size: 22pt;
    color: #0B2447;
    font-weight: 600;
    display: block;
    margin: 4mm 0 2mm;
  }
  .footer {
    margin-top: auto;
    width: 100%;
    display: table;
  }
  .footer .cell {
    display: table-cell;
    vertical-align: bottom;
    width: 33%;
    text-align: center;
    font-size: 10pt;
    color: #444;
  }
  .footer .cell .top {
    border-top: 1px solid #999;
    padding-top: 2mm;
    margin: 6mm 8mm 0;
    min-height: 16mm;
  }
  .qr-block {
    text-align: right;
  }
  .qr-block img {
    width: 28mm;
    height: 28mm;
    display: inline-block;
    border: 1px solid #ddd;
    background: #fff;
    padding: 2mm;
  }
  .qr-block .caption {
    font-size: 8pt;
    color: #555;
    margin-top: 1mm;
  }
  .qr-block .code {
    font-family: monospace;
    font-size: 7pt;
    color: #888;
    margin-top: 0.5mm;
    word-break: break-all;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="frame"></div>
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>

    <div class="content">
      <div class="logo-wrap">${tenantLogo}</div>

      <h1>Certificado de Conclusão</h1>
      <div class="underline"></div>

      <p class="lead">Certifica-se que</p>
      <div class="name">${fullName || "—"}</div>

      <div class="body">
        concluiu com aproveitamento o curso
        <span class="course">${esc(courseName)}</span>
        com a duração de <strong>${esc(durationHours)} horas</strong>,
        realizado entre <strong>${esc(fmtDate(startDate))}</strong> e
        <strong>${esc(fmtDate(endDate))}</strong>.
      </div>

      <div class="footer">
        <div class="cell">
          <div class="top">${esc(localCity)}, ${esc(fmtDateLong(issueDate))}</div>
          Local e data de emissão
        </div>
        <div class="cell">
          <div class="top" style="margin-bottom:2mm;"></div>
          A Direção
        </div>
        <div class="cell qr-block">
          ${
            qrDataUrl
              ? `<img src="${esc(qrDataUrl)}" alt="QR Verificação" />`
              : `<div style="width:28mm;height:28mm;border:1px dashed #999;display:inline-block;"></div>`
          }
          <div class="caption">Verificar autenticidade</div>
          <div class="code">${esc(verifyCode)}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export const certificadoMeta = { landscape: true };

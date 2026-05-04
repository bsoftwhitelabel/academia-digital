import type { ActionPDFData, LogoSet } from "./index";

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
  // UTC components: campos data-only em PG são guardados como midnight UTC.
  // Usar getUTC* evita desvios de timezone que partiriam o dia para legal docs.
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function logoBlock(
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

function header3Logos(
  logos: LogoSet,
  tenantName: string,
  clientName: string | null
): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
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

function field(label: string, value: unknown): string {
  return `
    <div style="display:flex;flex-direction:column;gap:2px;">
      <span style="font-size:8px;font-weight:600;color:#0B2447;text-transform:uppercase;letter-spacing:0.4px;">${esc(label)}</span>
      <span style="font-size:11px;color:#1a1a1a;border-bottom:1px solid #ccc;padding:2px 0;min-height:14px;">${esc(value)}</span>
    </div>
  `;
}

const RGPD_TEXT = `Tomei conhecimento e autorizo o tratamento dos meus dados pessoais para os fins associados à execução da formação, conforme o Regulamento Geral de Proteção de Dados (RGPD — Regulamento UE 2016/679). Os dados serão conservados pelo período legal exigido. Tenho o direito de aceder, retificar, eliminar ou opor-me ao tratamento, mediante pedido escrito à entidade formadora.`;

export function renderFichaIdentificacao(
  data: ActionPDFData,
  traineeId?: string
): string {
  const { action, tenant, trainees, logos } = data;
  const trainee =
    (traineeId && trainees.find((t: any) => t.id === traineeId)) ||
    trainees[0];

  if (!trainee) {
    return `<!doctype html><html><body><h1>Sem formando para a ficha</h1></body></html>`;
  }

  const fullName = `${esc(trainee.firstName)} ${esc(trainee.lastName)}`.trim();
  const morada = trainee.address || "";
  const courseArea = action.course?.area?.name || "—";
  const local =
    action.room?.name ||
    action.room?.city ||
    (action.format === "ELEARNING" ? "E-learning" : tenant?.name || "—");

  const gdprChecked = !!trainee.gdprConsent;

  // Assinatura do formando — DocumentSignature FICHA_IDENTIFICACAO SIGNED
  const fichaSig = (trainee.signatures || []).find(
    (s: any) =>
      s.documentType === "FICHA_IDENTIFICACAO" &&
      s.status === "SIGNED" &&
      s.signatureUrl
  );

  const today = fmtDate(new Date());

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>Ficha de Identificação — ${fullName}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    margin: 0;
    padding: 16px 22px;
    font-size: 11px;
  }
  h1 {
    color: #0B2447;
    font-size: 18px;
    text-align: center;
    margin: 8px 0 4px;
    letter-spacing: 0.6px;
  }
  h2 {
    color: #0B2447;
    font-size: 12px;
    margin: 16px 0 8px;
    border-bottom: 2px solid #C9A520;
    padding-bottom: 3px;
  }
  .grid {
    display: grid;
    gap: 10px 14px;
  }
  .grid.cols-2 { grid-template-columns: 1fr 1fr; }
  .grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
  .grid.cols-4 { grid-template-columns: 1.6fr 1fr 1fr 1fr; }
  .gdpr {
    margin-top: 14px;
    border: 1px solid #0B2447;
    border-radius: 4px;
    padding: 10px 12px;
    font-size: 9.5px;
    line-height: 1.5;
    background: #F7F8FA;
    color: #333;
  }
  .gdpr .row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 8px;
  }
  .checkbox {
    width: 14px;
    height: 14px;
    border: 1.5px solid #0B2447;
    border-radius: 2px;
    flex-shrink: 0;
    position: relative;
    margin-top: 1px;
  }
  .checkbox.checked::after {
    content: "✓";
    position: absolute;
    top: -3px;
    left: 1px;
    font-weight: 700;
    color: #0B2447;
    font-size: 14px;
  }
  .signature-block {
    margin-top: 24px;
    display: table;
    width: 100%;
  }
  .signature-block .cell {
    display: table-cell;
    width: 50%;
    vertical-align: top;
  }
  .signature-block .label {
    font-size: 9px;
    font-weight: 600;
    color: #0B2447;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 6px;
  }
  .signature-block .area {
    height: 56px;
    border-bottom: 1px solid #999;
    padding-top: 4px;
  }
  .signature-block img.sig {
    max-height: 50px;
    max-width: 220px;
  }
  .small { font-size: 9px; color: #666; }
</style>
</head>
<body>
  ${header3Logos(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null)}

  <h1>FICHA DE IDENTIFICAÇÃO / INSCRIÇÃO</h1>
  <p style="text-align:center;color:#666;font-size:10px;margin:0 0 4px;">
    Documento DGERT — preenchimento obrigatório
  </p>

  <h2>Dados do Formando</h2>
  <div class="grid cols-4">
    ${field("Nome Completo", fullName)}
    ${field("Data de Nascimento", fmtDate(trainee.birthDate))}
    ${field("Nacionalidade", trainee.nationality || "Portuguesa")}
    ${field("Naturalidade", trainee.naturality || "—")}
  </div>
  <div class="grid cols-4" style="margin-top:8px;">
    ${field("Nº BI / CC", trainee.idNumber)}
    ${field("Validade", fmtDate(trainee.idValidUntil))}
    ${field("NIF", trainee.nif)}
    ${field("Nº Segurança Social", trainee.ssn)}
  </div>
  <div class="grid cols-3" style="margin-top:8px;">
    ${field("Morada", morada)}
    ${field("Código Postal", trainee.postalCode)}
    ${field("Localidade", trainee.city)}
  </div>
  <div class="grid cols-4" style="margin-top:8px;">
    ${field("Email", trainee.email)}
    ${field("Telefone", trainee.phone)}
    ${field("Profissão", trainee.jobTitle)}
    ${field("Habilitações", trainee.educationLevel)}
  </div>

  <h2>Dados do Curso</h2>
  <div class="grid cols-3">
    ${field("Nome do Curso", action.course?.name)}
    ${field("Código", action.course?.code || action.actionCode)}
    ${field("Área de Formação", courseArea)}
  </div>
  <div class="grid cols-3" style="margin-top:8px;">
    ${field("Duração", `${action.course?.durationHours ?? "—"} h`)}
    ${field("Modalidade", action.format)}
    ${field("Datas", `${fmtDate(action.startDate)} a ${fmtDate(action.endDate)}`)}
  </div>

  <div class="gdpr">
    <strong style="color:#0B2447;">Consentimento RGPD</strong>
    <p style="margin:6px 0 0;">${esc(RGPD_TEXT)}</p>
    <div class="row">
      <div class="checkbox ${gdprChecked ? "checked" : ""}"></div>
      <div>
        ${
          gdprChecked
            ? `<strong>Consentimento dado em ${esc(fmtDate(trainee.gdprConsentAt))}.</strong>`
            : `Aceito as condições e dou o meu consentimento.`
        }
      </div>
    </div>
  </div>

  <div class="signature-block">
    <div class="cell">
      <div class="label">Assinatura do Formando</div>
      <div class="area">
        ${
          fichaSig
            ? `<img class="sig" src="${esc(fichaSig.signatureUrl)}" alt="Assinatura ${fullName}" />`
            : ""
        }
      </div>
      <div class="small">${fullName}</div>
    </div>
    <div class="cell" style="padding-left:18px;">
      <div class="label">Data e Local</div>
      <div class="area" style="border:none;height:auto;">
        <div style="font-size:11px;">${esc(local)}, ${esc(today)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export const fichaIdentificacaoMeta = { landscape: false };

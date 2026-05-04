// Geração de XML no formato SIGO/DGERT.
// SIGO = Sistema de Informação e Gestão da Oferta Educativa.
//
// Este módulo aceita actionIds, carrega dados via Prisma, e devolve
// strings XML prontas a download.

import prisma from "@/lib/prisma";

function esc(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ymd(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const FORMA: Record<string, string> = {
  PRESENCIAL: "PRESENCIAL",
  ELEARNING: "ELEARNING",
  BLENDED: "BLENDED",
};

/**
 * Gera o XML SIGO de Ações de Formação para o conjunto indicado.
 * Restringe ao tenant para evitar fugas cross-tenant.
 */
export async function generateSIGOActionsXML(
  tenantId: string,
  actionIds: string[]
): Promise<string> {
  if (!actionIds.length) {
    return wrapEnvelope("AccoesFormacao", "");
  }

  const actions = await prisma.trainingAction.findMany({
    where: { id: { in: actionIds }, tenantId },
    include: {
      course: { include: { area: true } },
      room: true,
      tenant: { select: { dgertCode: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const items = actions
    .map((a) => {
      const local =
        a.format === "ELEARNING"
          ? "Online"
          : a.room?.name || "Local a definir";
      return `  <AccaoFormacao>
    <Codigo>${esc(a.actionCode || a.id)}</Codigo>
    <NumeroAccao>${esc(a.actionNumber || "")}</NumeroAccao>
    <Designacao>${esc(a.course.name)}</Designacao>
    <AreaFormacao>${esc(a.course.area?.citeCode || "")}</AreaFormacao>
    <FormaOrganizacao>${esc(FORMA[a.format] || a.format)}</FormaOrganizacao>
    <DataInicio>${esc(ymd(a.startDate))}</DataInicio>
    <DataFim>${esc(ymd(a.endDate))}</DataFim>
    <DuracaoHoras>${esc(a.course.durationHours)}</DuracaoHoras>
    <EntidadeFormadora>${esc(a.tenant.dgertCode || "")}</EntidadeFormadora>
    <EntidadeFinanciadora>${esc(a.financingSystem || "")}</EntidadeFinanciadora>
    <LocalFormacao>${esc(local)}</LocalFormacao>
  </AccaoFormacao>`;
    })
    .join("\n");

  return wrapEnvelope("AccoesFormacao", items);
}

/**
 * Gera o XML SIGO de Formandos inscritos numa ação concreta.
 * Inclui percentagem de presença calculada a partir dos CheckIns.
 */
export async function generateSIGOTraineesXML(
  tenantId: string,
  actionId: string
): Promise<string> {
  const action = await prisma.trainingAction.findFirst({
    where: { id: actionId, tenantId },
    include: {
      sessions: { select: { id: true } },
      enrollments: {
        include: {
          trainee: {
            include: {
              checkIns: {
                where: { session: { trainingActionId: actionId } },
                select: { sessionId: true, status: true },
              },
            },
          },
        },
      },
    },
  });

  if (!action) {
    return wrapEnvelope("Formandos", "");
  }

  const totalSessions = action.sessions.length;

  const items = action.enrollments
    .map((e) => {
      const t = e.trainee;
      const present = t.checkIns.filter((c) => c.status !== "ABSENT").length;
      const presenca = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;
      const aprovado = e.passed === true;
      return `  <Formando>
    <NomeCompleto>${esc(`${t.firstName} ${t.lastName}`.trim())}</NomeCompleto>
    <DataNascimento>${esc(ymd(t.birthDate))}</DataNascimento>
    <Nacionalidade>${esc(t.nationality || "")}</Nacionalidade>
    <TipoIdentificacao>${esc(t.idType || "")}</TipoIdentificacao>
    <NumeroIdentificacao>${esc(t.idNumber || "")}</NumeroIdentificacao>
    <NIF>${esc(t.nif || "")}</NIF>
    <Habilitacoes>${esc(t.educationLevel || "")}</Habilitacoes>
    <SituacaoEmprego>${esc(t.employmentStatus || "")}</SituacaoEmprego>
    <Email>${esc(t.email)}</Email>
    <Presenca>${presenca}</Presenca>
    <Aprovado>${aprovado ? "true" : "false"}</Aprovado>
  </Formando>`;
    })
    .join("\n");

  return wrapEnvelope("Formandos", items, {
    AccaoCodigo: action.actionCode || action.id,
  });
}

function wrapEnvelope(
  rootName: string,
  inner: string,
  attrs: Record<string, string> = {}
): string {
  const now = new Date().toISOString();
  const attrsStr = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<SIGO geradoEm="${esc(now)}" versao="1.0">
  <${rootName}${attrsStr}>
${inner}
  </${rootName}>
</SIGO>`;
}

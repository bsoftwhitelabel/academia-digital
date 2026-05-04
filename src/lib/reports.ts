import prisma from "@/lib/prisma";

export type ReportType =
  | "ENROLLMENTS"
  | "ATTENDANCE"
  | "SATISFACTION"
  | "BUDGET"
  | "TRAINERS_HOURS"
  | "CERTIFICATES";

export type ReportFilters = {
  from?: string;
  to?: string;
  courseId?: string;
  trainerId?: string;
  clientOrgId?: string;
  status?: string;
};

export type ReportRow = Record<string, string | number | null>;

export type ReportResult = {
  title: string;
  columns: { key: string; label: string }[];
  rows: ReportRow[];
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function dateFilter(filters: ReportFilters): { gte?: Date; lte?: Date } | undefined {
  if (!filters.from && !filters.to) return undefined;
  const f: { gte?: Date; lte?: Date } = {};
  if (filters.from) f.gte = new Date(filters.from);
  if (filters.to) {
    const t = new Date(filters.to);
    t.setUTCHours(23, 59, 59, 999);
    f.lte = t;
  }
  return f;
}

export async function buildReport(
  type: ReportType,
  tenantId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  switch (type) {
    case "ENROLLMENTS":
      return enrollmentsReport(tenantId, filters);
    case "ATTENDANCE":
      return attendanceReport(tenantId, filters);
    case "SATISFACTION":
      return satisfactionReport(tenantId, filters);
    case "BUDGET":
      return budgetReport(tenantId, filters);
    case "TRAINERS_HOURS":
      return trainerHoursReport(tenantId, filters);
    case "CERTIFICATES":
      return certificatesReport(tenantId, filters);
    default:
      throw new Error(`Unknown report type: ${type}`);
  }
}

async function enrollmentsReport(tenantId: string, filters: ReportFilters): Promise<ReportResult> {
  const where: any = { trainingAction: { tenantId } };
  const dr = dateFilter(filters);
  if (dr) where.enrolledAt = dr;
  if (filters.status) where.status = filters.status;
  if (filters.courseId) where.trainingAction = { ...where.trainingAction, courseId: filters.courseId };
  if (filters.clientOrgId) where.trainingAction = { ...where.trainingAction, clientOrgId: filters.clientOrgId };

  const rows = await prisma.enrollment.findMany({
    where,
    include: {
      trainee: { include: { user: true } },
      trainingAction: { include: { course: true, clientOrg: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return {
    title: "Inscrições",
    columns: [
      { key: "data", label: "Data" },
      { key: "formando", label: "Formando" },
      { key: "email", label: "Email" },
      { key: "curso", label: "Curso" },
      { key: "cliente", label: "Cliente" },
      { key: "status", label: "Estado" },
    ],
    rows: rows.map((e) => ({
      data: fmtDate(e.enrolledAt),
      formando: `${e.trainee.user.firstName} ${e.trainee.user.lastName}`.trim(),
      email: e.trainee.user.email,
      curso: e.trainingAction.course.name,
      cliente: e.trainingAction.clientOrg?.name || "",
      status: e.status,
    })),
  };
}

async function attendanceReport(tenantId: string, filters: ReportFilters): Promise<ReportResult> {
  const where: any = { trainingAction: { tenantId } };
  const dr = dateFilter(filters);
  if (dr) where.sessionDate = dr;
  if (filters.courseId) where.trainingAction = { ...where.trainingAction, courseId: filters.courseId };

  const sessions = await prisma.trainingSession.findMany({
    where,
    include: {
      trainingAction: { include: { course: true } },
      checkIns: { include: { trainee: { include: { user: true } } } },
    },
    orderBy: { sessionDate: "desc" },
  });

  const rows: ReportRow[] = [];
  for (const s of sessions) {
    for (const a of s.checkIns) {
      rows.push({
        data: fmtDate(s.sessionDate),
        sessao: s.id.slice(0, 8),
        curso: s.trainingAction.course.name,
        formando: `${a.trainee.user.firstName} ${a.trainee.user.lastName}`.trim(),
        presenca: a.status,
        manual: a.isManual ? "Sim" : "Não",
      });
    }
  }

  return {
    title: "Presenças",
    columns: [
      { key: "data", label: "Data" },
      { key: "sessao", label: "Sessão" },
      { key: "curso", label: "Curso" },
      { key: "formando", label: "Formando" },
      { key: "presenca", label: "Presença" },
      { key: "manual", label: "Manual" },
    ],
    rows,
  };
}

async function satisfactionReport(tenantId: string, filters: ReportFilters): Promise<ReportResult> {
  const where: any = { questionnaire: { tenantId }, answers: { some: {} } };
  const dr = dateFilter(filters);
  if (dr) where.respondedAt = dr;

  const responses = await prisma.questionnaireResponse.findMany({
    where,
    include: { answers: { include: { question: true } } },
  });

  const actionIds = Array.from(new Set(responses.map((r) => r.trainingActionId).filter(Boolean) as string[]));
  const actionsMap = new Map<string, any>();
  if (actionIds.length > 0) {
    const acts = await prisma.trainingAction.findMany({
      where: { id: { in: actionIds }, tenantId },
      include: { course: true },
    });
    for (const a of acts) actionsMap.set(a.id, a);
  }

  const rows = responses.map((r) => {
    const action = r.trainingActionId ? actionsMap.get(r.trainingActionId) : null;
    const scaleAnswers = r.answers.filter((a) => a.question.type === "SCALE" && typeof a.scaleValue === "number");
    const avg = scaleAnswers.length
      ? scaleAnswers.reduce((s, a) => s + (a.scaleValue || 0), 0) / scaleAnswers.length
      : 0;
    return {
      data: fmtDate(r.respondedAt),
      curso: action?.course?.name || "",
      action: action?.actionCode || "",
      media: Number(avg.toFixed(2)),
      perguntas: scaleAnswers.length,
    };
  });

  return {
    title: "Satisfação",
    columns: [
      { key: "data", label: "Data" },
      { key: "curso", label: "Curso" },
      { key: "action", label: "Cód. Ação" },
      { key: "media", label: "Média (1-5)" },
      { key: "perguntas", label: "Nº perguntas" },
    ],
    rows,
  };
}

async function budgetReport(tenantId: string, filters: ReportFilters): Promise<ReportResult> {
  const actions = await prisma.trainingAction.findMany({
    where: { tenantId, ...(filters.courseId ? { courseId: filters.courseId } : {}) },
    include: { course: true, plan: true },
  });
  const actionIds = actions.map((a) => a.id);
  const [budgets, costs] = await Promise.all([
    prisma.budget.findMany({ where: { trainingActionId: { in: actionIds } } }),
    prisma.trainingCost.findMany({
      where: {
        trainingActionId: { in: actionIds },
        ...(filters.from || filters.to ? { date: dateFilter(filters) || {} } : {}),
      },
    }),
  ]);

  const rows = actions.map((a) => {
    const b = budgets.find((bb) => bb.trainingActionId === a.id);
    const sp = costs.filter((c) => c.trainingActionId === a.id).reduce((s, c) => s + c.amount, 0);
    const bg = b?.budgetedAmount || 0;
    const dv = sp - bg;
    return {
      action: a.actionCode || a.id.slice(0, 8),
      curso: a.course.name,
      plano: a.plan?.name || "",
      orcado: bg,
      gasto: sp,
      desvio: dv,
      pct: bg > 0 ? Number(((sp / bg) * 100).toFixed(1)) : 0,
    };
  });

  return {
    title: "Orçamento",
    columns: [
      { key: "action", label: "Cód. Ação" },
      { key: "curso", label: "Curso" },
      { key: "plano", label: "Plano" },
      { key: "orcado", label: "Orçado (€)" },
      { key: "gasto", label: "Gasto (€)" },
      { key: "desvio", label: "Desvio (€)" },
      { key: "pct", label: "% Execução" },
    ],
    rows,
  };
}

async function trainerHoursReport(tenantId: string, filters: ReportFilters): Promise<ReportResult> {
  const where: any = { trainingAction: { tenantId } };
  const dr = dateFilter(filters);
  if (dr) where.sessionDate = dr;

  const sessions = await prisma.trainingSession.findMany({
    where,
    include: {
      trainingAction: { include: { course: true, trainers: { include: { trainer: { include: { user: true } } } } } },
    },
  });

  const trainerHours: Record<string, { name: string; hours: number; sessions: number }> = {};
  for (const s of sessions) {
    const hours = s.durationHours || 0;
    for (const t of s.trainingAction.trainers) {
      if (filters.trainerId && t.trainerId !== filters.trainerId) continue;
      const key = t.trainerId;
      const name = `${t.trainer.user.firstName} ${t.trainer.user.lastName}`.trim();
      if (!trainerHours[key]) trainerHours[key] = { name, hours: 0, sessions: 0 };
      trainerHours[key].hours += hours;
      trainerHours[key].sessions += 1;
    }
  }

  return {
    title: "Horas por formador",
    columns: [
      { key: "formador", label: "Formador" },
      { key: "sessoes", label: "Nº Sessões" },
      { key: "horas", label: "Horas totais" },
    ],
    rows: Object.values(trainerHours)
      .sort((a, b) => b.hours - a.hours)
      .map((t) => ({ formador: t.name, sessoes: t.sessions, horas: Number(t.hours.toFixed(2)) })),
  };
}

async function certificatesReport(tenantId: string, filters: ReportFilters): Promise<ReportResult> {
  const where: any = { trainee: { tenantId } };
  const dr = dateFilter(filters);
  if (dr) where.issuedAt = dr;

  const certs = await prisma.certificate.findMany({
    where,
    include: { trainee: { include: { user: true } } },
    orderBy: { issuedAt: "desc" },
  });

  return {
    title: "Certificados",
    columns: [
      { key: "data", label: "Data emissão" },
      { key: "formando", label: "Formando" },
      { key: "email", label: "Email" },
      { key: "curso", label: "Curso" },
      { key: "horas", label: "Horas" },
      { key: "codigo", label: "Cód. Verificação" },
    ],
    rows: certs.map((c) => ({
      data: fmtDate(c.issuedAt),
      formando: `${c.trainee.firstName} ${c.trainee.lastName}`.trim(),
      email: c.trainee.user?.email || "",
      curso: c.courseName,
      horas: c.durationHours,
      codigo: c.verificationCode || "",
    })),
  };
}

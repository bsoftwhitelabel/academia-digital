import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { SatisfactionAlerts } from "@/emails/SatisfactionAlerts";

function authorized(req: Request): boolean {
  const vercel = req.headers.get("x-vercel-cron");
  if (vercel) return true;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

type Alert = {
  responseRateAlert: boolean;
  trainerAlerts: { trainerId: string; name: string; average: number; count: number }[];
  staleActions: { id: string; code: string; name: string; daysSince: number | null }[];
  courseAlerts: { courseId: string; name: string; average: number; responses: number }[];
  globalAverage: number;
  responseRate: number;
};

async function computeAlerts(tenantId: string): Promise<Alert> {
  const responses = await prisma.questionnaireResponse.findMany({
    where: { questionnaire: { tenantId }, answers: { some: {} } },
    include: { answers: { include: { question: true } } },
  });

  const actionIds = Array.from(new Set(responses.map((r) => r.trainingActionId).filter(Boolean) as string[]));
  const actionsMap = new Map<string, any>();
  if (actionIds.length > 0) {
    const acts = await prisma.trainingAction.findMany({
      where: { id: { in: actionIds }, tenantId },
      include: {
        course: { select: { id: true, name: true } },
        trainers: { include: { trainer: { include: { user: true } } } },
      },
    });
    for (const a of acts) actionsMap.set(a.id, a);
  }

  let allScale: number[] = [];
  const byTrainer: Record<string, { name: string; sum: number; count: number }> = {};
  const byCourse: Record<string, { name: string; sum: number; count: number }> = {};

  for (const r of responses) {
    const action = r.trainingActionId ? actionsMap.get(r.trainingActionId) : null;
    for (const a of r.answers) {
      if (a.question.type === "SCALE" && typeof a.scaleValue === "number") {
        allScale.push(a.scaleValue);
        for (const t of action?.trainers || []) {
          const name = `${t.trainer.user.firstName} ${t.trainer.user.lastName}`.trim();
          if (!byTrainer[t.trainerId]) byTrainer[t.trainerId] = { name, sum: 0, count: 0 };
          byTrainer[t.trainerId].sum += a.scaleValue;
          byTrainer[t.trainerId].count += 1;
        }
        const cid = action?.courseId;
        const cname = action?.course?.name;
        if (cid && cname) {
          if (!byCourse[cid]) byCourse[cid] = { name: cname, sum: 0, count: 0 };
          byCourse[cid].sum += a.scaleValue;
          byCourse[cid].count += 1;
        }
      }
    }
  }

  const globalAverage = allScale.length > 0
    ? Number((allScale.reduce((s, n) => s + n, 0) / allScale.length).toFixed(2))
    : 0;
  const totalGenerated = await prisma.questionnaireResponse.count({ where: { questionnaire: { tenantId } } });
  const totalResponded = responses.length;
  const responseRate = totalGenerated > 0 ? Math.round((totalResponded / totalGenerated) * 100) : 0;

  const trainerAlerts = Object.entries(byTrainer)
    .map(([id, v]) => ({ trainerId: id, name: v.name, average: Number((v.sum / v.count).toFixed(2)), count: v.count }))
    .filter((t) => t.average < 3.5)
    .sort((a, b) => a.average - b.average);

  const courseAlerts = Object.entries(byCourse)
    .map(([id, v]) => ({ courseId: id, name: v.name, average: Number((v.sum / v.count).toFixed(2)), responses: v.count }))
    .filter((c) => c.average < 3.5)
    .sort((a, b) => a.average - b.average);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const completedActions = await prisma.trainingAction.findMany({
    where: { tenantId, status: "COMPLETED", endDate: { lt: sevenDaysAgo } },
    include: { course: { select: { name: true } } },
  });
  const completedIds = completedActions.map((a) => a.id);
  const respondedActionIds = new Set<string>();
  if (completedIds.length > 0) {
    const respondedRows = await prisma.questionnaireResponse.findMany({
      where: { trainingActionId: { in: completedIds }, questionnaire: { tenantId }, answers: { some: {} } },
      select: { trainingActionId: true },
    });
    for (const r of respondedRows) if (r.trainingActionId) respondedActionIds.add(r.trainingActionId);
  }
  const staleActions = completedActions
    .filter((a) => !respondedActionIds.has(a.id))
    .map((a) => ({
      id: a.id,
      name: a.course.name,
      code: a.actionCode || a.id.slice(0, 8),
      daysSince: a.endDate ? Math.floor((Date.now() - a.endDate.getTime()) / 86400000) : null,
    }));

  return {
    responseRateAlert: responseRate < 50 && totalGenerated >= 10,
    trainerAlerts,
    staleActions,
    courseAlerts,
    globalAverage,
    responseRate,
  };
}

export async function GET(req: Request) {
  try {
    if (!authorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenants = await prisma.tenant.findMany({ where: { isActive: true } });
    const summary: any[] = [];

    for (const tenant of tenants) {
      const alerts = await computeAlerts(tenant.id);
      const totalAlerts =
        (alerts.responseRateAlert ? 1 : 0) +
        alerts.trainerAlerts.length +
        alerts.staleActions.length +
        alerts.courseAlerts.length;

      if (totalAlerts === 0) {
        summary.push({ tenantId: tenant.id, slug: tenant.slug, alerts: 0, sent: 0 });
        continue;
      }

      const admins = await prisma.user.findMany({
        where: { tenantId: tenant.id, role: "TENANT_ADMIN", isActive: true },
        select: { email: true },
      });

      let sent = 0;
      let failed = 0;
      for (const admin of admins) {
        try {
          await sendEmail({
            to: admin.email,
            subject: `[${tenant.name}] Alertas de satisfação — ${totalAlerts} item(ns) requerem atenção`,
            template: SatisfactionAlerts,
            data: {
              tenantNome: tenant.name,
              tenantLogoUrl: tenant.logoUrl,
              appUrl: process.env.NEXT_PUBLIC_APP_URL,
              globalAverage: alerts.globalAverage,
              responseRate: alerts.responseRate,
              responseRateAlert: alerts.responseRateAlert,
              trainerAlerts: alerts.trainerAlerts,
              staleActions: alerts.staleActions,
              courseAlerts: alerts.courseAlerts,
            },
            tenantId: tenant.id,
            event: "INQUIRY_RECEIVED", // placeholder: log channel
          });
          sent++;
        } catch (e) {
          console.error("[cron/satisfaction-alerts] send failed:", e);
          failed++;
        }
      }

      summary.push({
        tenantId: tenant.id,
        slug: tenant.slug,
        alerts: totalAlerts,
        admins: admins.length,
        sent,
        failed,
      });
    }

    return NextResponse.json({ success: true, tenants: tenants.length, summary });
  } catch (e: any) {
    console.error("Cron satisfaction-alerts error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

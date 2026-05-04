import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";

function fmtDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function authorized(req: Request): boolean {
  // 1) Vercel Cron usa header `x-vercel-cron: 1`
  const vercel = req.headers.get("x-vercel-cron");
  if (vercel) return true;
  // 2) Authorization: Bearer ${CRON_SECRET}
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev: aberto
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

function tomorrowUtcRange(): { start: Date; end: Date } {
  const now = new Date();
  // "Amanhã" em horário UTC: dia atual UTC + 1
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 0, 0, 0));
  return { start, end };
}

export async function GET(req: Request) {
  try {
    if (!authorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { start, end } = tomorrowUtcRange();
    const sessions = await prisma.trainingSession.findMany({
      where: {
        sessionDate: { gte: start, lt: end },
        isOpen: false,
        isClosed: false,
      },
      include: {
        trainingAction: {
          include: {
            course: true,
            room: true,
            tenant: true,
            enrollments: {
              where: { status: "CONFIRMED" },
              include: { trainee: { include: { user: true } } },
            },
          },
        },
      },
    });

    let totalEmails = 0;
    let failed = 0;

    for (const ts of sessions) {
      const action = ts.trainingAction;
      const tenant = action.tenant;
      const local =
        action.room?.name ||
        (action.format === "ELEARNING" ? "E-learning" : "Local a confirmar");

      for (const enr of action.enrollments) {
        try {
          await sendNotification({
            event: "SESSION_REMINDER_24H",
            traineeId: enr.traineeId,
            tenantId: tenant.id,
            data: {
              cursoNome: action.course.name,
              data: fmtDate(ts.sessionDate),
              horaInicio: ts.startTime,
              horaFim: ts.endTime,
              local,
              sessionId: ts.id,
            },
          });
          totalEmails++;
        } catch (e) {
          console.error("[cron/reminders] send failed:", e);
          failed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      sessions: sessions.length,
      emails: totalEmails,
      failed,
    });
  } catch (e: any) {
    console.error("Cron reminders error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

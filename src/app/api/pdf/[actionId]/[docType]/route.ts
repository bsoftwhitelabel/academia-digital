import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generatePDF } from "@/lib/pdf";
import { getLogosAsBase64 } from "@/lib/pdf-logos";
import {
  ACTION_RENDERERS,
  DOSSIER_ORDER,
  PER_TRAINEE_DOCS,
  PER_TRAINER_DOCS,
  CERTIFICATE_RENDERER,
} from "@/lib/pdf-registry";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUPPORTED = new Set([
  ...Object.keys(ACTION_RENDERERS),
  "CERTIFICADO",
  "CERTIFICADO_CONCLUSAO",
  "DOSSIER_COMPLETO",
  "ZIP",
]);

async function loadActionFull(actionId: string) {
  const action = await prisma.trainingAction.findUnique({
    where: { id: actionId },
    include: {
      course: { include: { area: true, modules: true } },
      clientOrg: true,
      room: true,
      plan: true,
      trainers: {
        include: {
          trainer: {
            include: {
              user: true,
              trainingAreas: true,
            },
          },
        },
      },
      sessions: { orderBy: { sessionDate: "asc" } },
      occurrences: { orderBy: { occurredAt: "asc" } },
      enrollments: {
        include: {
          trainee: {
            include: {
              clientOrg: true,
              signatures: true,
              checkIns: true,
            },
          },
        },
      },
    },
  });
  if (!action) return null;

  // Trainer não tem relação inversa para DocumentSignature — carregamos por trainerId
  const trainerIds = action.trainers.map((t) => t.trainerId);
  if (trainerIds.length > 0) {
    const trainerSigs = await prisma.documentSignature.findMany({
      where: { trainerId: { in: trainerIds } },
    });
    const sigsByTrainer = new Map<string, any[]>();
    for (const s of trainerSigs) {
      if (!s.trainerId) continue;
      if (!sigsByTrainer.has(s.trainerId)) sigsByTrainer.set(s.trainerId, []);
      sigsByTrainer.get(s.trainerId)!.push(s);
    }
    for (const t of action.trainers) {
      (t.trainer as any).signatures = sigsByTrainer.get(t.trainerId) || [];
    }
  }
  return action;
}

function pickTrainees(action: any) {
  return (action.enrollments || []).map((e: any) => ({
    id: e.traineeId,
    enrollmentId: e.id,
    firstName: e.trainee.firstName,
    lastName: e.trainee.lastName,
    nif: e.trainee.nif,
    ssn: e.trainee.ssn,
    birthDate: e.trainee.birthDate,
    idNumber: e.trainee.idNumber,
    idValidUntil: e.trainee.idValidUntil,
    nationality: e.trainee.nationality,
    email: e.trainee.email,
    phone: e.trainee.phone,
    address: e.trainee.address,
    postalCode: e.trainee.postalCode,
    city: e.trainee.city,
    jobTitle: e.trainee.jobTitle,
    educationLevel: e.trainee.educationLevel,
    gdprConsent: e.trainee.gdprConsent,
    gdprConsentAt: e.trainee.gdprConsentAt,
    clientOrgName: e.trainee.clientOrg?.name || null,
    signatures: e.trainee.signatures,
    checkIns: e.trainee.checkIns,
  }));
}

async function renderToPdf(
  html: string,
  landscape: boolean
): Promise<Buffer> {
  return generatePDF(html, { landscape });
}

async function authorize(actionTenantId: string, session: any) {
  const role = session.user.role;
  if (role === "SUPER_ADMIN") return true;
  if (actionTenantId !== session.user.tenantId) return false;
  if (role === "TENANT_ADMIN" || role === "TENANT_STAFF") return true;
  if (role === "TRAINER") {
    const trainer = await prisma.trainer.findUnique({ where: { userId: session.user.id } });
    if (!trainer) return false;
    return true; // a verificação fina por ação faz-se mais à frente
  }
  return false;
}

export async function GET(
  req: Request,
  { params }: { params: { actionId: string; docType: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const docType = params.docType.toUpperCase();
    if (!SUPPORTED.has(docType)) {
      return NextResponse.json({ error: `docType "${docType}" não suportado` }, { status: 400 });
    }

    const action = await loadActionFull(params.actionId);
    if (!action) return NextResponse.json({ error: "Ação não encontrada" }, { status: 404 });

    const allowed = await authorize(action.tenantId, session);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // TRAINER: limitar a ações onde está atribuído
    if (session.user.role === "TRAINER") {
      const trainer = await prisma.trainer.findUnique({ where: { userId: session.user.id } });
      const isAssigned = !!trainer && action.trainers.some((t) => t.trainerId === trainer.id);
      if (!isAssigned) return NextResponse.json({ error: "Not assigned" }, { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: action.tenantId } });
    const logos = await getLogosAsBase64(action.tenantId, action.clientOrgId);
    const trainees = pickTrainees(action);
    const data = { action, tenant, trainees, logos };

    const url = new URL(req.url);

    // ─── CERTIFICADO ──────────────────────────────────────────
    if (docType === "CERTIFICADO" || docType === "CERTIFICADO_CONCLUSAO") {
      const traineeId = url.searchParams.get("traineeId");
      const trainee = traineeId ? trainees.find((t) => t.id === traineeId) : trainees[0];
      if (!trainee) {
        return NextResponse.json({ error: "Sem formandos para emitir certificado" }, { status: 400 });
      }
      const cert = await prisma.certificate.findFirst({
        where: { traineeId: trainee.id, courseName: action.course.name },
        orderBy: { issuedAt: "desc" },
      });
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const certDraft = cert ?? {
        id: "DRAFT",
        traineeId: trainee.id,
        courseName: action.course.name,
        courseCode: action.course.code,
        durationHours: action.course.durationHours,
        completedAt: action.endDate,
        issuedAt: new Date(),
        verificationCode: `DRAFT-${action.id.slice(0, 8)}-${trainee.id.slice(0, 8)}`,
      };
      const verifyUrl = `${baseUrl.replace(/\/$/, "")}/verify/${certDraft.verificationCode}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: "M", margin: 1, width: 320, color: { dark: "#0B2447", light: "#FFFFFF" },
      });
      const html = CERTIFICATE_RENDERER({
        trainee, course: action.course, action, certificate: certDraft, tenant, logos,
        qrDataUrl, verifyUrl,
      } as any);
      const buffer = await renderToPdf(html, true);
      return pdfResponse(buffer, `certificado-${slug(trainee.firstName + "-" + trainee.lastName)}.pdf`);
    }

    // ─── DOSSIER_COMPLETO (merge único PDF) ────────────────────
    if (docType === "DOSSIER_COMPLETO") {
      const merged = await PDFDocument.create();
      for (const buf of await renderAllDossierBuffers(data)) {
        const src = await PDFDocument.load(buf);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const out = Buffer.from(await merged.save());
      const fname = `DTP-${action.actionCode || action.id.slice(0, 8)}-${ymd(new Date())}.pdf`;
      return pdfResponse(out, fname);
    }

    // ─── ZIP (cada doc num PDF individual) ─────────────────────
    if (docType === "ZIP") {
      const zip = new JSZip();
      for (const item of await renderAllDossierWithNames(data)) {
        zip.file(item.fileName, item.buffer);
      }
      const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
      const fname = `DTP-${action.actionCode || action.id.slice(0, 8)}.zip`;
      return new NextResponse(zipBuf, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${fname}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // ─── Documento individual ──────────────────────────────────
    const reg = ACTION_RENDERERS[docType];
    if (!reg) {
      return NextResponse.json({ error: `docType "${docType}" sem renderer` }, { status: 400 });
    }
    const subId = url.searchParams.get("traineeId") || url.searchParams.get("trainerId") || url.searchParams.get("sessionId") || undefined;
    const html = reg.renderer(data as any, subId);
    let landscape = !!reg.landscape;
    if (docType === "REGISTO_PRESENCAS") landscape = trainees.length > 8;
    const buffer = await renderToPdf(html, landscape);
    return pdfResponse(buffer, `${reg.nameSlug}.pdf`);
  } catch (error: any) {
    console.error("PDF route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function pdfResponse(buffer: Buffer, fileName: string) {
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function ymd(d: Date) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Gera todos os PDFs do dossier (ordem oficial), expandindo per-trainee/per-trainer
async function renderAllDossierWithNames(data: any): Promise<Array<{ fileName: string; buffer: Buffer }>> {
  const out: Array<{ fileName: string; buffer: Buffer }> = [];
  const { action, trainees } = data;
  const trainers = (action.trainers || []) as any[];

  for (const docType of DOSSIER_ORDER) {
    const reg = ACTION_RENDERERS[docType];
    if (!reg) continue;

    if (PER_TRAINEE_DOCS.has(docType) && trainees.length > 0) {
      for (const t of trainees) {
        const html = reg.renderer(data, t.id);
        const buf = await renderToPdf(html, !!reg.landscape);
        out.push({
          fileName: `${reg.nameSlug}-${slug(t.firstName + "-" + t.lastName)}.pdf`,
          buffer: buf,
        });
      }
    } else if (PER_TRAINER_DOCS.has(docType) && trainers.length > 0) {
      for (const t of trainers) {
        const html = reg.renderer(data, t.trainerId);
        const buf = await renderToPdf(html, !!reg.landscape);
        const u = t.trainer?.user || {};
        out.push({
          fileName: `${reg.nameSlug}-${slug(u.firstName + "-" + u.lastName)}.pdf`,
          buffer: buf,
        });
      }
    } else {
      const landscape = !!reg.landscape || (docType === "REGISTO_PRESENCAS" && trainees.length > 8);
      const html = reg.renderer(data);
      const buf = await renderToPdf(html, landscape);
      out.push({ fileName: `${reg.nameSlug}.pdf`, buffer: buf });
    }
  }

  return out;
}

async function renderAllDossierBuffers(data: any): Promise<Buffer[]> {
  return (await renderAllDossierWithNames(data)).map((x) => x.buffer);
}

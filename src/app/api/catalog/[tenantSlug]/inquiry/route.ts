import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { NewInquiry } from "@/emails/NewInquiry";

export async function POST(
  req: Request,
  { params }: { params: { tenantSlug: string } }
) {
  try {
    const data = await req.json();
    const {
      courseId,
      courseName,
      firstName,
      lastName,
      email,
      company,
      jobTitle,
      phone,
      message,
      // Campos B2B (opcionais)
      isB2B,
      nif,
      setor,
      empRange,
      formato,
      preferredDate,
      howFound,
      workshopIds,
      workshopNames,
    } = data;

    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.tenantSlug },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant não encontrado" },
        { status: 404 }
      );
    }

    // 1. Salvar no banco — se B2B, enriquecer o campo `message` com detalhes
    //    (mantém compatibilidade com schema existente sem coluna metadata)
    const finalMessage = isB2B && (nif || setor || empRange || formato || preferredDate || workshopNames?.length)
      ? [
          message ? `Mensagem: ${message}` : "",
          `--- Pedido B2B ---`,
          nif ? `NIF: ${nif}` : "",
          setor ? `Setor: ${setor}` : "",
          empRange ? `Nº colaboradores: ${empRange}` : "",
          formato ? `Formato: ${formato}` : "",
          preferredDate ? `Data preferida: ${preferredDate}` : "",
          howFound ? `Como conheceu: ${howFound}` : "",
          Array.isArray(workshopNames) && workshopNames.length > 0
            ? `Workshops:\n - ${workshopNames.join("\n - ")}`
            : "",
        ].filter(Boolean).join("\n")
      : message;

    const inquiry = await prisma.inquiry.create({
      data: {
        tenantId: tenant.id,
        courseId: courseId || (Array.isArray(workshopIds) && workshopIds.length > 0 ? workshopIds[0] : null),
        courseName,
        firstName,
        lastName,
        email,
        company,
        jobTitle,
        phone,
        message: finalMessage,
        source: isB2B ? "B2B_PROPOSAL" : "CATALOG",
      },
    });

    // 2. Notificar a entidade formadora
    const recipient = tenant.emailFromAddress;
    if (recipient) {
      const subject = isB2B
        ? `[B2B] Pedido de proposta — ${courseName} (${empRange || "?"} colaboradores)`
        : `Novo interesse no curso: ${courseName}`;

      sendEmail({
        to: recipient,
        subject,
        template: NewInquiry,
        data: {
          inquiryNome: `${firstName} ${lastName}`.trim(),
          inquiryEmail: email,
          inquiryEmpresa: company,
          inquiryCargo: jobTitle,
          inquiryTelefone: phone,
          cursoNome: courseName,
          mensagem: finalMessage,
          tenantNome: tenant.name,
          tenantLogoUrl: tenant.logoUrl,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        },
        tenantId: tenant.id,
        event: "INQUIRY_RECEIVED",
      }).catch((e) => console.error("[inquiry] email error:", e));

      // 3. (B2B) resposta automática ao prospect
      if (isB2B) {
        sendEmail({
          to: email,
          subject: `Recebemos o seu pedido — ${tenant.name}`,
          template: NewInquiry,
          data: {
            inquiryNome: `${firstName} ${lastName}`.trim(),
            inquiryEmail: email,
            inquiryEmpresa: company,
            inquiryCargo: jobTitle,
            inquiryTelefone: phone,
            cursoNome: courseName,
            mensagem: `Recebemos o seu pedido de proposta para ${
              workshopNames?.length === 1 ? workshopNames[0] :
              workshopNames?.length ? `${workshopNames.length} workshops` : courseName
            }. A nossa equipa entrará em contacto em 24 horas.`,
            tenantNome: tenant.name,
            tenantLogoUrl: tenant.logoUrl,
            appUrl: process.env.NEXT_PUBLIC_APP_URL,
          },
          tenantId: tenant.id,
          event: "INQUIRY_RECEIVED",
        }).catch((e) => console.error("[inquiry] auto-reply error:", e));
      }
    }

    return NextResponse.json({ success: true, id: inquiry.id });
  } catch (error) {
    console.error("Erro ao salvar inquiry:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor" },
      { status: 500 }
    );
  }
}

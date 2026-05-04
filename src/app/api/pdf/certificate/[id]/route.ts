import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import puppeteer from "puppeteer";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "TRAINEE") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const trainee = await prisma.trainee.findUnique({
      where: { userId: session.user.id },
      include: { tenant: true },
    });

    if (!trainee) {
      return new NextResponse("Trainee not found", { status: 404 });
    }

    const certificate = await prisma.certificate.findUnique({
      where: { id: params.id },
    });

    if (!certificate || certificate.traineeId !== trainee.id) {
      return new NextResponse("Certificate not found", { status: 404 });
    }

    // HTML simples do certificado
    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center; padding: 50px; }
            .container { border: 10px solid #0B2447; padding: 50px; background-color: #F7F8FA; }
            .title { font-size: 50px; font-weight: bold; color: #0B2447; margin-bottom: 20px; }
            .subtitle { font-size: 24px; color: #C9A520; margin-bottom: 40px; }
            .content { font-size: 20px; line-height: 1.6; color: #333; margin-bottom: 60px; }
            .signature { margin-top: 60px; border-top: 2px solid #0B2447; width: 300px; margin-left: auto; margin-right: auto; padding-top: 10px; font-weight: bold; }
            .footer { margin-top: 40px; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="title">Certificado de Conclusão</div>
            <div class="subtitle">${trainee.tenant?.name || "Academia Digital"}</div>
            
            <div class="content">
              Certificamos que<br>
              <strong><span style="font-size: 30px; color: #0B2447;">${trainee.firstName} ${trainee.lastName}</span></strong><br><br>
              concluiu com aproveitamento o curso<br>
              <strong><span style="font-size: 26px; color: #C9A520;">${certificate.courseName}</span></strong><br><br>
              com a carga horária total de ${certificate.durationHours} horas.
            </div>

            <div class="signature">
              A Direção
            </div>

            <div class="footer">
              Código de Verificação: ${certificate.verificationCode}<br>
              Emitido a: ${new Date(certificate.issuedAt).toLocaleDateString("pt-PT")}
            </div>
          </div>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificado-${certificate.courseName.replace(/\s+/g, "_")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

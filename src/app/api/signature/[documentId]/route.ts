import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { logAudit } from "@/lib/audit";

// Configuração R2 (Cloudflare)
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(
  req: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "TRAINEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trainee = await prisma.trainee.findUnique({
      where: { userId: session.user.id },
    });

    if (!trainee) {
      return NextResponse.json({ error: "Trainee not found" }, { status: 404 });
    }

    const { signatureData, sessionId } = await req.json();

    if (!signatureData) {
      return NextResponse.json({ error: "No signature provided" }, { status: 400 });
    }

    const documentSignature = await prisma.documentSignature.findUnique({
      where: { id: params.documentId },
      include: {
        session: {
          include: { trainingAction: true },
        },
      },
    });

    if (!documentSignature) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (documentSignature.traineeId !== trainee.id) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    if (documentSignature.status !== "ENABLED") {
      return NextResponse.json({ error: "Signature not enabled" }, { status: 400 });
    }

    const tenantId = session.user.tenantId;
    const ipAddress = req.headers.get("x-forwarded-for") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // O signatureData é uma string base64: "data:image/png;base64,iVBORw0KGgo..."
    const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `signatures/${tenantId}/${params.documentId}/${trainee.id}.png`;

    let signatureUrl = "";

    // Upload to Cloudflare R2
    if (process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET_NAME) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: "image/png",
          ACL: "public-read",
        })
      );
      
      const publicUrl = process.env.R2_PUBLIC_URL || "";
      signatureUrl = `${publicUrl}/${fileName}`;
    } else {
      // Fallback local se R2 não configurado
      signatureUrl = `data:image/png;base64,${base64Data}`;
    }

    const updatedSig = await prisma.documentSignature.update({
      where: { id: params.documentId },
      data: {
        status: "SIGNED",
        signatureUrl,
        signedAt: new Date(),
        ipAddress,
        userAgent,
      },
    });

    await logAudit({
      action: "CREATE",
      resource: "DocumentSignature",
      resourceId: updatedSig.id,
      userId: session.user.id,
      tenantId,
      changes: {
        before: { status: documentSignature.status },
        after: { status: "SIGNED", signedAt: updatedSig.signedAt, ipAddress },
      },
      req,
    });

    return NextResponse.json({ success: true, url: signatureUrl });
  } catch (error) {
    console.error("Signature error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

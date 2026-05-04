import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignatureCanvas } from "@/components/signature/SignatureCanvas";
import { FileSignature, XCircle } from "lucide-react";

export default async function SignDocumentPage({
  params,
  searchParams,
}: {
  params: { documentId: string };
  searchParams: { sessionId?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TRAINEE") {
    redirect("/login");
  }

  const trainee = await prisma.trainee.findUnique({
    where: { userId: session.user.id },
  });

  if (!trainee) {
    redirect("/trainee/dashboard");
  }

  const documentSignature = await prisma.documentSignature.findUnique({
    where: { id: params.documentId },
    include: {
      session: {
        include: {
          trainingAction: {
            include: { course: true },
          },
        },
      },
    },
  });

  if (!documentSignature) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <XCircle className="h-16 w-16 text-red-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Documento não encontrado</h2>
      </div>
    );
  }

  // Validação: Documento pertence ao formando?
  if (documentSignature.traineeId !== trainee.id) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <XCircle className="h-16 w-16 text-red-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Acesso Negado</h2>
      </div>
    );
  }

  // Validação: Está no estado ENABLED?
  if (documentSignature.status !== "ENABLED") {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <XCircle className="h-16 w-16 text-yellow-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Assinatura Indisponível</h2>
        <p className="mt-2 text-gray-500">
          Este documento ainda não foi habilitado para assinatura pelo formador, ou já foi assinado/revogado.
        </p>
      </div>
    );
  }

  const courseName = documentSignature.session?.trainingAction.course.name || "Documento Geral";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#0B2447]">Assinatura Digital</h1>
        <p className="mt-2 text-gray-600">
          Por favor, assine no quadro abaixo para confirmar a leitura e concordância.
        </p>
      </div>

      <Card>
        <CardHeader className="bg-gray-50 pb-6 border-b">
          <div className="flex items-center gap-3 text-[#0B2447]">
            <FileSignature className="h-6 w-6 text-[#C9A520]" />
            <CardTitle className="text-xl">
              {documentSignature.documentType.replace(/_/g, " ")}
            </CardTitle>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Referente ao curso: <span className="font-semibold text-gray-700">{courseName}</span>
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <SignatureCanvas
            documentId={documentSignature.id}
            sessionId={searchParams.sessionId}
          />
        </CardContent>
      </Card>
    </div>
  );
}

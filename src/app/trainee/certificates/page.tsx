import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Award, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

export default async function TraineeCertificatesPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TRAINEE") {
    redirect("/login");
  }

  const trainee = await prisma.trainee.findUnique({
    where: { userId: session.user.id },
  });

  if (!trainee) {
    return <div className="p-8 text-center text-gray-500">Perfil não encontrado.</div>;
  }

  const certificates = await prisma.certificate.findMany({
    where: { traineeId: trainee.id },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#0B2447]">Meus Certificados</h1>
        <p className="mt-2 text-gray-600">Acesse e faça o download dos seus certificados de conclusão.</p>
      </div>

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
            <Award className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900">Nenhum certificado emitido</h3>
            <p className="mt-2 text-sm">Os seus certificados aparecerão aqui após concluir a formação.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => {
            const isValid = !cert.expiresAt || new Date() < cert.expiresAt;

            return (
              <Card key={cert.id} className="flex flex-col">
                <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex justify-between items-start">
                    <Award className="h-8 w-8 text-[#C9A520]" />
                    <Badge variant="outline" className={isValid ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}>
                      {isValid ? "Válido" : "Expirado"}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4 text-xl text-[#0B2447] line-clamp-2">
                    {cert.courseName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-1 flex-col">
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Concluído a: {format(new Date(cert.completedAt), "dd/MM/yyyy")}</span>
                    </div>
                    {cert.expiresAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-red-400" />
                        <span>Válido até: {format(new Date(cert.expiresAt), "dd/MM/yyyy")}</span>
                      </div>
                    )}
                    <div className="pt-2 text-xs text-gray-400 font-mono">
                      Código: {cert.verificationCode}
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-6">
                    <a
                      href={cert.fileUrl ? cert.fileUrl : `/api/pdf/certificate/${cert.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded bg-[#0B2447] px-4 py-2 font-medium text-white transition-colors hover:bg-[#153460]"
                    >
                      <Download className="h-4 w-4" />
                      Descarregar
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

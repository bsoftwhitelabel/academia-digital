import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Download } from "lucide-react";

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export default async function ClientDocumentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { clientHrOrgId: true },
  });
  if (!user?.clientHrOrgId) {
    return <p>Utilizador sem ClientOrg associada.</p>;
  }

  const certs = await prisma.certificate.findMany({
    where: { trainee: { clientOrgId: user.clientHrOrgId } },
    include: { trainee: true },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Certificados</h1>
        <p className="text-sm text-gray-600">{certs.length} certificados emitidos.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-lg text-[#0B2447]">Emitidos</CardTitle></CardHeader>
        <CardContent>
          {certs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Sem certificados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="px-2 py-2">Formando</th>
                  <th className="px-2 py-2">Curso</th>
                  <th className="px-2 py-2">Conclusão</th>
                  <th className="px-2 py-2">Emitido</th>
                  <th className="px-2 py-2 text-right">Download</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-2 py-2 font-semibold text-[#0B2447]">
                      {c.trainee.firstName} {c.trainee.lastName}
                    </td>
                    <td className="px-2 py-2">{c.courseName}</td>
                    <td className="px-2 py-2">{fmtDate(c.completedAt)}</td>
                    <td className="px-2 py-2">{fmtDate(c.issuedAt)}</td>
                    <td className="px-2 py-2 text-right">
                      <Button asChild variant="ghost" size="icon-sm" title="Descarregar">
                        <Link href={`/api/pdf/certificate/${c.id}`}>
                          <Download className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

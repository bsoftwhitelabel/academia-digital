"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

export default function ActionSurveysPage() {
  const params = useParams<{ id: string }>();
  const { data, error, isLoading } = useSWR(
    `/api/admin/actions/${params.id}/surveys`,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (error) {
    return <p className="text-red-600">Erro a carregar respostas.</p>;
  }
  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin text-[#C9A520]" />
        A carregar…
      </div>
    );
  }

  const rate = data.total > 0 ? Math.round((data.responded / data.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Respostas Recebidas</h1>
        <p className="text-sm text-gray-600">Atualização automática a cada 30s</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#0B2447]">{data.total}</div>
            <p className="mt-1 text-xs text-gray-500">questionários gerados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Respondidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="survey-counter">
              {data.responded}/{data.total}
            </div>
            <p className="mt-1 text-xs text-gray-500">{rate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{data.pending}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#0B2447]">Lista de Respostas</CardTitle>
        </CardHeader>
        <CardContent>
          {data.responses.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Sem respostas ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="px-2 py-2">Questionário</th>
                  <th className="px-2 py-2">Formando</th>
                  <th className="px-2 py-2">Estado</th>
                  <th className="px-2 py-2">Respondido em</th>
                </tr>
              </thead>
              <tbody>
                {data.responses.map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-2 py-2">{r.questionnaire}</td>
                    <td className="px-2 py-2 font-mono text-xs">{r.traineeId?.slice(0, 8) || "—"}</td>
                    <td className="px-2 py-2">
                      {r.respondedAt ? (
                        <Badge className="bg-green-600 text-white">Respondido</Badge>
                      ) : (
                        <Badge className="bg-gray-400 text-white">Pendente</Badge>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs">{fmtDateTime(r.respondedAt)}</td>
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

"use client";

import useSWR from "swr";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type LiveSession = {
  sessionId: string;
  courseName: string;
  trainerName: string;
  present: number;
  total: number;
} | null;

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function LiveBanner() {
  const { data } = useSWR<{ session: LiveSession }>(
    "/api/admin/dashboard/live",
    fetcher,
    { refreshInterval: 30000 }
  );
  const s = data?.session;
  if (!s) return null;
  return (
    <div
      className="flex flex-col items-start justify-between gap-3 rounded-lg bg-green-600 p-5 text-white shadow sm:flex-row sm:items-center"
      data-testid="live-banner"
    >
      <div>
        <span className="mb-1 inline-block rounded bg-white/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
          Sessão em Curso Agora
        </span>
        <h3 className="text-lg font-bold sm:text-xl">{s.courseName}</h3>
        <p className="mt-0.5 text-sm text-green-50">
          Formador: {s.trainerName} · {s.present}/{s.total} check-ins
        </p>
      </div>
      <Button asChild className="bg-white text-green-700 hover:bg-green-50">
        <Link href={`/trainer/sessions/${s.sessionId}/attendance`}>Ver ao Vivo</Link>
      </Button>
    </div>
  );
}

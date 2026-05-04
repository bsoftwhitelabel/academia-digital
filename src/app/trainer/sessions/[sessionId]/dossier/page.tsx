import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DossierClient from "./DossierClient";

export default async function DossierPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "TRAINER" && session.user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true },
  });

  const trainerName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Formador";

  return (
    <DossierClient sessionId={params.sessionId} trainerName={trainerName} />
  );
}

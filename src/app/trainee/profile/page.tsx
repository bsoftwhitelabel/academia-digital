import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationPrefs } from "./NotificationPrefs";

export default async function TraineeProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "TRAINEE") {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      notifEmail: true,
      notifWhatsApp: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">O meu perfil</h1>
        <p className="text-sm text-gray-600">Atualize os seus dados e preferências de notificação.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#0B2447]">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-gray-500">Nome</dt>
              <dd className="font-medium text-[#0B2447]">{user?.firstName} {user?.lastName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Email</dt>
              <dd className="font-medium text-[#0B2447]">{user?.email}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <NotificationPrefs
        initialEmail={user?.notifEmail !== false}
        initialWhatsApp={user?.notifWhatsApp !== false}
        initialPhone={user?.phone || ""}
      />
    </div>
  );
}

import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SurveyWizard } from "./SurveyWizard";

export const dynamic = "force-dynamic";

export default async function SurveyPage({
  params,
}: {
  params: { token: string };
}) {
  const response = await prisma.questionnaireResponse.findUnique({
    where: { token: params.token },
    include: {
      questionnaire: {
        include: {
          questions: { orderBy: { order: "asc" } },
        },
      },
      _count: { select: { answers: true } },
    },
  });

  if (!response) notFound();

  // Schema tem respondedAt @default(now()) — usamos answers como indicador real.
  const isSubmitted = response._count.answers > 0;

  // Carregar info contextual (tenant + ação)
  const tenant = await prisma.tenant.findUnique({
    where: { id: response.questionnaire.tenantId },
    select: { name: true, logoUrl: true, primaryColor: true, accentColor: true },
  });

  const action = response.trainingActionId
    ? await prisma.trainingAction.findUnique({
        where: { id: response.trainingActionId },
        include: { course: { select: { name: true } } },
      })
    : null;

  // Validações
  if (isSubmitted) {
    return (
      <SurveyError
        title="Já respondeu a este questionário"
        message="Obrigado! A sua resposta foi recebida anteriormente."
        tenant={tenant}
      />
    );
  }
  if (action?.status === "CANCELLED") {
    return (
      <SurveyError
        title="Ação cancelada"
        message="Esta ação de formação foi cancelada."
        tenant={tenant}
      />
    );
  }

  return (
    <SurveyWizard
      token={params.token}
      title={response.questionnaire.name}
      courseName={action?.course?.name ?? null}
      tenantName={tenant?.name ?? "Academia Digital"}
      tenantLogoUrl={tenant?.logoUrl ?? null}
      primaryColor={tenant?.primaryColor || "#0B2447"}
      accentColor={tenant?.accentColor || "#C9A520"}
      questions={response.questionnaire.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        scaleMin: q.scaleMin,
        scaleMax: q.scaleMax,
        isRequired: q.isRequired,
      }))}
    />
  );
}

function SurveyError({
  title,
  message,
  tenant,
}: {
  title: string;
  message: string;
  tenant: any;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F8FA] p-6 text-center">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow border border-gray-200">
        {tenant?.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="mx-auto mb-4 max-h-12" />
        ) : (
          <h2 className="mb-4 text-lg font-bold text-[#0B2447]">{tenant?.name || "Academia Digital"}</h2>
        )}
        <h1 className="text-xl font-semibold text-[#0B2447]">{title}</h1>
        <p className="mt-3 text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

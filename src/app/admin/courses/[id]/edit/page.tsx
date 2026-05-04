import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CourseForm } from "../../CourseForm";

export default async function EditCoursePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const [course, areas] = await Promise.all([
    prisma.course.findUnique({ where: { id: params.id } }),
    prisma.trainingArea.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!course || course.tenantId !== session.user.tenantId) notFound();

  return (
    <CourseForm
      isNew={false}
      areas={areas.map((a) => ({ id: a.id, name: a.name }))}
      initial={{
        id: course.id,
        name: course.name,
        sigla: course.sigla,
        code: course.code,
        durationHours: course.durationHours,
        format: course.format,
        areaId: course.areaId,
        shortDescription: course.shortDescription || "",
        fullDescription: course.fullDescription || "",
        objectives: course.objectives || "",
        targetAudience: course.targetAudience || "",
        methodology: course.methodology || "",
        evaluationMethod: course.evaluationMethod || "",
        coverImageUrl: course.coverImageUrl,
        price: course.price,
        tags: course.tags,
        seoTitle: course.seoTitle || "",
        seoDescription: course.seoDescription || "",
        status: course.status,
      }}
    />
  );
}

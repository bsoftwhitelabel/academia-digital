import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CourseForm } from "../CourseForm";

export default async function NewCoursePage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const areas = await prisma.trainingArea.findMany({ orderBy: { name: "asc" } });
  return (
    <CourseForm
      isNew
      areas={areas.map((a) => ({ id: a.id, name: a.name }))}
      initial={{
        name: "",
        durationHours: 8,
        format: "PRESENCIAL",
        status: "DRAFT",
        tags: [],
      }}
    />
  );
}

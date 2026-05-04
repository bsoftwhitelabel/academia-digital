import prisma from "@/lib/prisma";
import { CourseCard } from "./CourseCard";

export async function FeaturedSection({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const featuredCourses = await prisma.course.findMany({
    where: {
      tenantId,
      status: "FEATURED",
    },
    include: {
      area: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 4, // Exibir até 4 em destaque
  });

  if (featuredCourses.length === 0) {
    return null;
  }

  return (
    <section className="mb-16">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-3xl font-bold text-[#0B2447]">Em Destaque</h2>
        <span className="hidden sm:inline-block rounded-full bg-[#C9A520]/10 px-4 py-1 text-sm font-semibold text-[#C9A520]">
          Cursos Premium
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {featuredCourses.map((course) => (
          <div key={course.id} className="relative">
            {/* The Badge is already inside CourseCard, but we can wrap it or ensure CourseCard handles FEATURED status */}
            <CourseCard course={course as any} tenantSlug={tenantSlug} />
          </div>
        ))}
      </div>
    </section>
  );
}

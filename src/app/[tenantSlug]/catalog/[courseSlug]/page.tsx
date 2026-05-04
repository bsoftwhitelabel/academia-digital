import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { InquiryDialog } from "@/components/catalog/InquiryForm";

interface CoursePageProps {
  params: {
    tenantSlug: string;
    courseSlug: string;
  };
}

export async function generateMetadata({
  params,
}: CoursePageProps): Promise<Metadata> {
  const course = await prisma.course.findFirst({
    where: {
      slug: params.courseSlug,
      tenant: { slug: params.tenantSlug },
    },
    include: { tenant: true },
  });

  if (!course) {
    return { title: "Curso não encontrado" };
  }

  return {
    title: course.seoTitle || `${course.name} | ${course.tenant.name}`,
    description: course.seoDescription || course.shortDescription,
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const course = await prisma.course.findFirst({
    where: {
      slug: params.courseSlug,
      tenant: { slug: params.tenantSlug },
    },
    include: {
      area: true,
      tenant: true,
      trainingActions: {
        where: {
          status: "SCHEDULED",
          startDate: { gt: new Date() },
        },
        include: {
          _count: {
            select: { enrollments: true },
          },
          room: true,
        },
        orderBy: {
          startDate: "asc",
        },
      },
    },
  });

  if (!course) {
    notFound();
  }

  // Build JSON-LD schema.org Course
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const tenantUrl = course.tenant.domain
    ? `https://${course.tenant.domain}`
    : `${baseUrl.replace(/\/$/, "")}/${course.tenant.slug}`;
  const nextSession = course.trainingActions[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.name,
    description: course.shortDescription || `${course.name} — ${course.tenant.name}`,
    provider: {
      "@type": "Organization",
      name: course.tenant.name,
      url: tenantUrl,
    },
    ...(course.coverImageUrl ? { image: course.coverImageUrl } : {}),
    ...(nextSession
      ? {
          hasCourseInstance: [
            {
              "@type": "CourseInstance",
              courseMode: course.format,
              startDate: nextSession.startDate.toISOString().slice(0, 10),
              endDate: nextSession.endDate.toISOString().slice(0, 10),
            },
          ],
        }
      : {}),
  };

  // Filtrar ações com vagas
  const availableActions = course.trainingActions.filter(
    (action) =>
      !action.maxTrainees || action._count.enrollments < action.maxTrainees
  );

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-16">
      {/* schema.org Course (JSON-LD para SEO) */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <div className="relative bg-[#0B2447] text-white">
        {course.coverImageUrl && (
          <div className="absolute inset-0 z-0 opacity-20">
            <img
              src={course.coverImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="container relative z-10 mx-auto px-4 py-20">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {course.area && (
              <span className="text-sm font-bold uppercase tracking-widest text-[#C9A520]">
                {course.area.name}
              </span>
            )}
            <Badge variant="secondary" className="bg-white text-[#0B2447]">
              {course.format}
            </Badge>
          </div>
          <h1 className="text-4xl font-extrabold md:text-5xl lg:text-6xl">
            {course.name}
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-gray-300 md:text-xl">
            {course.shortDescription}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-6 text-sm font-medium">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#C9A520]" />
              <span>{course.durationHours} horas</span>
            </div>
            {course.price && (
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#C9A520] px-3 py-1 font-bold text-[#0B2447]">
                  {course.price} €
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto mt-12 grid grid-cols-1 gap-12 px-4 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-12 rounded-lg bg-white p-8 shadow-sm">
          {course.fullDescription && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-[#0B2447]">
                Sobre o Curso
              </h2>
              <div
                className="prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: course.fullDescription }}
              />
            </section>
          )}

          {course.objectives && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-[#0B2447]">
                Objetivos
              </h2>
              <div
                className="prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: course.objectives }}
              />
            </section>
          )}

          {course.targetAudience && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-[#0B2447]">
                Destinatários
              </h2>
              <div
                className="prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: course.targetAudience }}
              />
            </section>
          )}

          {course.methodology && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-[#0B2447]">
                Metodologia
              </h2>
              <div
                className="prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: course.methodology }}
              />
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-[#0B2447]">
              Interessado neste curso?
            </h3>
            <p className="mb-6 text-sm text-gray-600">
              Demonstre o seu interesse para receber mais informações sobre turmas
              e valores.
            </p>
            <InquiryDialog courseId={course.id} courseName={course.name} tenantSlug={params.tenantSlug} />
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-6 text-xl font-bold text-[#0B2447]">
              Próximas Sessões
            </h3>
            {availableActions.length === 0 ? (
              <p className="text-sm text-gray-500">
                Não existem sessões agendadas de momento. Demonstre interesse para
                ser notificado!
              </p>
            ) : (
              <div className="space-y-4">
                {availableActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex flex-col gap-2 rounded border border-gray-100 p-4"
                  >
                    <div className="flex items-center gap-2 text-[#0B2447]">
                      <Calendar className="h-4 w-4 text-[#C9A520]" />
                      <span className="font-semibold text-sm">
                        {format(new Date(action.startDate), "dd 'de' MMMM, yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    {action.room && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>{action.room.name}</span>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-500">
                      {action.maxTrainees && (
                        <span>
                          {action.maxTrainees - action._count.enrollments} vagas
                          restantes
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";

export type TrackableCardProps = {
  href: string;
  courseSlug: string;
  tenantSlug: string;
  area?: string | null;
  className?: string;
  children: React.ReactNode;
};

/**
 * Wrapper que dispara um evento `course_view` no Vercel Analytics quando
 * o card é clicado. Usar à volta de `<CourseCard />` ou de qualquer link
 * para uma ficha de curso.
 */
export function TrackableCard({
  href,
  courseSlug,
  tenantSlug,
  area,
  className,
  children,
}: TrackableCardProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        try {
          track("course_view", {
            courseSlug,
            tenantSlug,
            area: area || "—",
          });
        } catch {}
      }}
    >
      {children}
    </Link>
  );
}

/** Helper para usar no submit do formulário de inquiry. */
export function trackInquirySubmitted(args: {
  courseSlug?: string | null;
  tenantSlug: string;
  source?: string;
}) {
  try {
    track("inquiry_submitted", {
      courseSlug: args.courseSlug || "—",
      tenantSlug: args.tenantSlug,
      source: args.source || "catalog",
    });
  } catch {}
}

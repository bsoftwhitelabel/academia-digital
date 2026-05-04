import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/*/catalog", "/*/catalog/*"],
        disallow: ["/admin", "/trainer", "/trainee", "/client", "/api"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Academia Digital",
    short_name: "Academia",
    description: "Plataforma de Formação — Portal do Formador e Formando",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F8FA",
    theme_color: "#0B2447",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

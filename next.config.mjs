/** @type {import('next').NextConfig} */
const baseSecurityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

// CSP aplicado apenas a rotas autenticadas (admin/trainer/trainee/client)
// — não ao catálogo público para não bloquear imagens externas de cursos.
const cspHeader = {
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
};

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: baseSecurityHeaders,
      },
      {
        source: "/admin/:path*",
        headers: [...baseSecurityHeaders, cspHeader],
      },
      {
        source: "/trainer/:path*",
        headers: [...baseSecurityHeaders, cspHeader],
      },
      {
        source: "/trainee/:path*",
        headers: [...baseSecurityHeaders, cspHeader],
      },
      {
        source: "/client/:path*",
        headers: [...baseSecurityHeaders, cspHeader],
      },
    ];
  },
};

export default nextConfig;

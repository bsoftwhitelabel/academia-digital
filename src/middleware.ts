import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = token.role as string;

    // Regras de autorização por role
    if (path.startsWith("/admin")) {
      if (!["SUPER_ADMIN", "TENANT_ADMIN", "TENANT_STAFF"].includes(role)) {
        return new NextResponse("403 Forbidden: Insufficient role", { status: 403 });
      }
    }

    if (path.startsWith("/trainer")) {
      if (role !== "TRAINER" && role !== "SUPER_ADMIN") {
        return new NextResponse("403 Forbidden: Insufficient role", { status: 403 });
      }
    }

    if (path.startsWith("/trainee")) {
      if (role !== "TRAINEE" && role !== "SUPER_ADMIN") {
        return new NextResponse("403 Forbidden: Insufficient role", { status: 403 });
      }
    }

    if (path.startsWith("/client")) {
      if (role !== "CLIENT_HR" && role !== "SUPER_ADMIN") {
        return new NextResponse("403 Forbidden: Insufficient role", { status: 403 });
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Retorna true se houver token (deixa a função middleware acima decidir as roles)
      // Se não houver token, redireciona automaticamente para a página de login
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/trainer/:path*",
    "/trainee/:path*",
    "/client/:path*",
  ],
};

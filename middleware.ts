import { NextRequest, NextResponse } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifyToken(token);
  const isLogin = pathname === "/login";

  // Já logado tentando acessar /login => manda para o dashboard.
  if (isLogin) {
    if (userId) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  // Demais rotas exigem sessão.
  if (!userId) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Aplica a tudo, exceto assets internos do Next e imagens públicas
// (logo/favicon precisam carregar sem sessão, ex.: na tela de login).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.png|favicon.png).*)",
  ],
};

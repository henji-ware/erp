import { NextRequest, NextResponse } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/session";
import { isPublicPath, PATHNAME_HEADER } from "@/lib/routes";

// Segue a requisição repassando o caminho ao layout (o middleware roda no edge
// e não consulta o banco; quem valida se a conta ainda existe é o layout).
function forward(req: NextRequest, pathname: string) {
  const headers = new Headers(req.headers);
  headers.set(PATHNAME_HEADER, pathname);
  return NextResponse.next({ request: { headers } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifyToken(token);

  if (isPublicPath(pathname)) {
    // Já logado tentando acessar /login => manda para o dashboard. Com um
    // erro na URL o login é mostrado assim mesmo: é o caso da sessão cujo
    // usuário sumiu, e devolvê-la ao dashboard criaria um loop.
    const hasError = req.nextUrl.searchParams.has("error");
    if (pathname === "/login" && userId && !hasError) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return forward(req, pathname);
  }

  // Demais rotas exigem sessão.
  if (!userId) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  return forward(req, pathname);
}

// Aplica a tudo, exceto assets internos do Next e imagens públicas
// (logo/favicon precisam carregar sem sessão, ex.: na tela de login).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.png|favicon.png).*)",
  ],
};

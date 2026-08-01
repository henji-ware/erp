import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Encerra uma sessão órfã: o cookie ainda tem assinatura válida, mas a conta
// foi desativada ou excluída. O layout redireciona para cá porque um server
// component não pode apagar cookie — sem isso o middleware devolveria o
// usuário ao dashboard e o layout de volta ao login, em loop.
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login?error=inactive", req.url));
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return res;
}

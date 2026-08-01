// Rotas acessíveis sem login (fluxos de e-mail + cron protegido por segredo).
// Compartilhado pelo middleware (edge) e pelo layout, que também precisa saber
// se a rota é pública para não redirecionar em loop.
export const PUBLIC_PATHS = ["/login", "/verify", "/forgot", "/reset", "/api/cron"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Cabeçalho com o caminho da requisição, injetado pelo middleware. O layout
// não recebe a rota como prop, e precisa dela para o redirecionamento acima.
export const PATHNAME_HEADER = "x-pathname";

// Rota que apaga o cookie de uma sessão sem usuário e leva ao login.
export const SESSION_END_PATH = "/api/session/end";

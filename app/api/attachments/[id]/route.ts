import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

// Baixa o anexo de um orçamento. Protegido pelo middleware (exige login).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const att = await prisma.attachment.findUnique({ where: { id: Number(id) } });
  if (!att) return new Response("Anexo não encontrado", { status: 404 });

  const headers = {
    "Content-Type": att.mimeType || "application/octet-stream",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
  };

  try {
    if (att.url) {
      // Nuvem: redireciona direto para o Vercel Blob (evita repassar arquivos
      // grandes pelo servidor, que tem limite de resposta).
      return Response.redirect(att.url, 302);
    }
    // Local: lê do disco.
    const buf = await readFile(path.join(process.cwd(), "uploads", att.storedName));
    return new Response(new Uint8Array(buf), { headers });
  } catch {
    return new Response("Arquivo ausente no servidor", { status: 404 });
  }
}

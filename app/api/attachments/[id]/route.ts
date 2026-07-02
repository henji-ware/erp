import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { blobToken } from "@/lib/blob";

// Baixa o anexo. Protegido pelo middleware (exige login). O store do Blob é
// PRIVADO: o arquivo é buscado com o token e transmitido (stream) pelo app —
// a URL do Blob não abre direto no navegador.
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
      // Nuvem (store privado): busca autenticada + stream para o navegador.
      const { get } = await import("@vercel/blob");
      const res = await get(att.url, { access: "private", token: blobToken() });
      if (!res) return new Response("Arquivo ausente", { status: 404 });
      return new Response(res.stream, { headers });
    }
    // Local: lê do disco.
    const buf = await readFile(path.join(process.cwd(), "uploads", att.storedName));
    return new Response(new Uint8Array(buf), { headers });
  } catch {
    return new Response("Arquivo ausente no servidor", { status: 404 });
  }
}

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { blobToken } from "@/lib/blob";

// Diagnóstico (não expõe o valor do token): abre no navegador logado e mostra
// se o servidor enxerga o token do Blob e se consegue gravar de verdade.
export async function GET() {
  const names = Object.keys(process.env).filter((k) => k.endsWith("_READ_WRITE_TOKEN"));
  const token = blobToken();

  // Teste real: grava e apaga um arquivinho no Blob para capturar o erro exato.
  let testeDeEscrita = "não executado (sem token)";
  if (token) {
    try {
      const { put, del } = await import("@vercel/blob");
      const blob = await put("diagnostico/ping.txt", "ok", {
        access: "public",
        token,
        addRandomSuffix: true,
      });
      await del(blob.url, { token }).catch(() => {});
      testeDeEscrita = "OK — upload no Blob funcionando";
    } catch (e) {
      testeDeEscrita = `FALHOU: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({
    blobConfigurado: !!token,
    variaveisEncontradas: names,
    formatoValido: token ? token.startsWith("vercel_blob_rw_") : false,
    tamanhoDoToken: token ? token.length : 0,
    testeDeEscrita,
  });
}

// Autoriza uploads direto do navegador para o Vercel Blob (client upload).
// Assim o arquivo não passa pelo servidor e escapa do limite de ~4,5 MB
// por requisição da Vercel. Protegido pelo middleware (exige sessão).
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const token = blobToken();
    if (!token) {
      return NextResponse.json(
        { error: "Vercel Blob não configurado (nenhum *_READ_WRITE_TOKEN no ambiente)" },
        { status: 400 },
      );
    }
    const jsonResponse = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
        addRandomSuffix: true,
      }),
      // O registro no banco é feito pelo cliente após o upload concluir.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

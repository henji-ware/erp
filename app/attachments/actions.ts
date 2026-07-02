"use server";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { blobToken } from "@/lib/blob";

// Pasta de uploads local (fora de /public => só baixa via rota autenticada).
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const ALLOWED: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

// Tipos de "dono" que um anexo pode ter. Cada um vira uma coluna FK no banco
// e uma rota de detalhe que precisa ser revalidada.
type OwnerType = "lead" | "project" | "inspection";

const OWNER: Record<OwnerType, { field: "leadId" | "projectId" | "inspectionId"; path: string; entity: string }> = {
  lead: { field: "leadId", path: "/leads", entity: "Orçamento" },
  project: { field: "projectId", path: "/projects", entity: "Projeto" },
  inspection: { field: "inspectionId", path: "/inspections", entity: "Inspeção" },
};

function useBlob() {
  return !!blobToken();
}

function parseOwner(formData: FormData): { type: OwnerType; id: number } | null {
  const type = String(formData.get("ownerType") ?? "") as OwnerType;
  const id = Number(formData.get("ownerId"));
  if (!OWNER[type] || !id) return null;
  return { type, id };
}

export async function uploadAttachment(formData: FormData) {
  const owner = parseOwner(formData);
  const file = formData.get("file");
  if (!owner || !(file instanceof File) || file.size === 0) return;

  // Valida tipo (PDF ou Word) por mimetype ou extensão.
  const lowerName = file.name.toLowerCase();
  const okByName = /\.(pdf|doc|docx)$/.test(lowerName);
  if (!ALLOWED[file.type] && !okByName) return;

  const ext =
    ALLOWED[file.type] ??
    (lowerName.endsWith(".docx") ? ".docx" : lowerName.endsWith(".doc") ? ".doc" : ".pdf");
  const storedName = `${randomUUID()}${ext}`;

  const cfgOwner = OWNER[owner.type];

  // Em produção (Vercel) o disco é somente leitura: sem o Blob configurado,
  // o upload não tem onde salvar — avisa em vez de quebrar.
  if (!useBlob() && process.env.VERCEL) {
    redirect(`${cfgOwner.path}/${owner.id}?attach=noblob`);
  }

  let url: string | null = null;

  try {
    if (useBlob()) {
      // Nuvem: salva no Vercel Blob.
      const { put } = await import("@vercel/blob");
      const blob = await put(`anexos/${storedName}`, file, {
        access: "public",
        contentType: file.type || "application/octet-stream",
        token: blobToken(),
      });
      url = blob.url;
    } else {
      // Local: salva em disco.
      await mkdir(UPLOAD_DIR, { recursive: true });
      const bytes = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(UPLOAD_DIR, storedName), bytes);
    }
  } catch (e) {
    console.error("[attachments] falha no upload:", e);
    redirect(`${cfgOwner.path}/${owner.id}?attach=fail`);
  }

  const cfg = cfgOwner;
  await prisma.attachment.create({
    data: {
      [cfg.field]: owner.id,
      fileName: file.name,
      storedName,
      url,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    },
  });

  await logAudit({
    action: "CREATE",
    entity: cfg.entity,
    entityId: owner.id,
    summary: `Anexou "${file.name}"`,
  });

  revalidatePath(`${cfg.path}/${owner.id}`);
}

// Registra no banco um arquivo já enviado direto do navegador para o Blob
// (client upload). Chamado pelo AttachmentsCard após o upload concluir.
export async function registerClientUpload(input: {
  ownerType: string;
  ownerId: number;
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
}) {
  const type = input.ownerType as OwnerType;
  const cfg = OWNER[type];
  const id = Number(input.ownerId);
  if (!cfg || !id || !input.url || !input.fileName) return;

  await prisma.attachment.create({
    data: {
      [cfg.field]: id,
      fileName: input.fileName,
      storedName: input.url.split("/").pop() ?? input.fileName,
      url: input.url,
      mimeType: input.mimeType || "application/octet-stream",
      size: Math.max(0, Math.floor(input.size)),
    },
  });

  await logAudit({
    action: "CREATE",
    entity: cfg.entity,
    entityId: id,
    summary: `Anexou "${input.fileName}"`,
  });

  revalidatePath(`${cfg.path}/${id}`);
}

export async function deleteAttachment(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return;

  await prisma.attachment.delete({ where: { id } });

  try {
    if (att.url) {
      const { del } = await import("@vercel/blob");
      await del(att.url, { token: blobToken() });
    } else {
      await unlink(path.join(UPLOAD_DIR, att.storedName));
    }
  } catch {
    /* arquivo já ausente */
  }

  // Revalida a página de detalhe do dono (qualquer que seja).
  if (att.leadId) revalidatePath(`/leads/${att.leadId}`);
  if (att.projectId) revalidatePath(`/projects/${att.projectId}`);
  if (att.inspectionId) revalidatePath(`/inspections/${att.inspectionId}`);
}

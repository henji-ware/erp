"use server";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

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
  return !!process.env.BLOB_READ_WRITE_TOKEN;
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

  let url: string | null = null;

  if (useBlob()) {
    // Nuvem: salva no Vercel Blob.
    const { put } = await import("@vercel/blob");
    const blob = await put(`anexos/${storedName}`, file, {
      access: "public",
      contentType: file.type || "application/octet-stream",
    });
    url = blob.url;
  } else {
    // Local: salva em disco.
    await mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, storedName), bytes);
  }

  const cfg = OWNER[owner.type];
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

export async function deleteAttachment(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return;

  await prisma.attachment.delete({ where: { id } });

  try {
    if (att.url) {
      const { del } = await import("@vercel/blob");
      await del(att.url);
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

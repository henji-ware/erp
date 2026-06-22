"use server";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Pasta de uploads local (fora de /public => só baixa via rota autenticada).
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const ALLOWED: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

function useBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function uploadAttachment(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  const file = formData.get("file");
  if (!leadId || !(file instanceof File) || file.size === 0) return;

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
    const blob = await put(`propostas/${storedName}`, file, {
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

  await prisma.attachment.create({
    data: {
      leadId,
      fileName: file.name,
      storedName,
      url,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    },
  });

  revalidatePath(`/leads/${leadId}`);
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

  revalidatePath(`/leads/${att.leadId}`);
}

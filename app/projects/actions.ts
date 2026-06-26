"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { asEnum, PROJECT_TYPES, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export async function createProject(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const customerId = Number(formData.get("customerId"));
  if (!title || !customerId) return;
  const type = asEnum(PROJECT_TYPES, formData.get("type"), "ENGENHARIA");

  const project = await prisma.project.create({
    data: {
      number: "PRJ-" + Date.now().toString(36).toUpperCase(),
      title,
      type,
      status: "ORCAMENTO",
      customerId,
      responsibleId: Number(formData.get("responsibleId")) || null,
      value: num(formData.get("value")),
      location: str(formData.get("location")),
      startDate: date(formData.get("startDate")),
      endDate: date(formData.get("endDate")),
      notes: str(formData.get("notes")),
    },
  });
  await logAudit({ action: "CREATE", entity: "Projeto", entityId: project.id, summary: `Projeto ${project.number} criado` });

  revalidatePath("/projects");
  revalidatePath("/");
}

export async function updateProject(formData: FormData) {
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const customerId = Number(formData.get("customerId"));
  if (!id || !title || !customerId) return;

  await prisma.project.update({
    where: { id },
    data: {
      title,
      type: asEnum(PROJECT_TYPES, formData.get("type"), "ENGENHARIA"),
      customerId,
      responsibleId: Number(formData.get("responsibleId")) || null,
      value: num(formData.get("value")),
      location: str(formData.get("location")),
      startDate: date(formData.get("startDate")),
      endDate: date(formData.get("endDate")),
      notes: str(formData.get("notes")),
    },
  });
  await logAudit({ action: "UPDATE", entity: "Projeto", entityId: id, summary: `Projeto "${title}" editado` });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function setProjectStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !PROJECT_STATUSES.includes(status as (typeof PROJECT_STATUSES)[number])) return;

  await prisma.project.update({
    where: { id },
    data: { status: asEnum(PROJECT_STATUSES, status, "ORCAMENTO") },
  });
  await logAudit({ action: "STATUS", entity: "Projeto", entityId: id, summary: `Status → ${PROJECT_STATUS_LABELS[status]}` });
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function deleteProject(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.project.delete({ where: { id } });
  await logAudit({ action: "DELETE", entity: "Projeto", entityId: id, summary: "Projeto excluído" });
  revalidatePath("/projects");
  revalidatePath("/");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function num(v: FormDataEntryValue | null): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function date(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  return s ? new Date(s) : null;
}

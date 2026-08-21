"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { asEnum, PROJECT_TYPES, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEditRecord } from "@/lib/auth";
import { parseMoney } from "@/lib/money";

// Autorização: só o dono (ou admin) altera o projeto.
async function allowed(id: number): Promise<boolean> {
  return canEditRecord(await prisma.project.findUnique({ where: { id }, select: { ownerId: true } }));
}

export async function createProject(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const customerId = Number(formData.get("customerId"));
  if (!title || !customerId) return;
  const type = asEnum(PROJECT_TYPES, formData.get("type"), "ENGENHARIA");

  const user = await getCurrentUser();
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
      refCode: str(formData.get("refCode")),
      notes: str(formData.get("notes")),
      ownerId: user?.id ?? null,
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
  if (!(await allowed(id))) return;

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
  if (!(await allowed(id))) return;

  await prisma.project.update({
    where: { id },
    data: { status: asEnum(PROJECT_STATUSES, status, "ORCAMENTO") },
  });
  await logAudit({ action: "STATUS", entity: "Projeto", entityId: id, summary: `Status → ${PROJECT_STATUS_LABELS[status]}` });
  revalidatePath("/projects");
  revalidatePath("/");
}

// Gera uma conta a receber (financeiro) a partir do projeto. Permite faturar
// por etapas: cada chamada cria um lançamento vinculado ao projeto.
export async function invoiceProject(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  if (!projectId) return;
  if (!(await allowed(projectId))) return;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return;

  const amount = num(formData.get("amount")) || project.value;
  if (amount <= 0) return;

  const dueRaw = String(formData.get("dueDate") ?? "");
  const due = dueRaw ? new Date(dueRaw) : addDays(new Date(), 30);
  const description =
    str(formData.get("description")) ?? `Faturamento do projeto ${project.number}`;

  await prisma.transaction.create({
    data: {
      description,
      type: "RECEIVABLE",
      amount,
      dueDate: due,
      status: "PENDING",
      projectId,
      customerId: project.customerId,
      ownerId: project.ownerId,
    },
  });
  await logAudit({ action: "CREATE", entity: "Projeto", entityId: projectId, summary: `Faturado ${description}` });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/finance");
  revalidatePath("/");
}

export async function deleteProject(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  if (!(await allowed(id))) return;
  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entity: "Projeto", entityId: id, summary: "Projeto arquivado" });
  revalidatePath("/projects");
  revalidatePath("/");
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function num(v: FormDataEntryValue | null): number {
  return parseMoney(v);
}
function date(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  return s ? new Date(s) : null;
}

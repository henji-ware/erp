"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PROJECT_TYPES, PROJECT_STATUSES } from "@/lib/format";

export async function createProject(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const customerId = Number(formData.get("customerId"));
  const type = String(formData.get("type") ?? "ENGENHARIA");
  if (!title || !customerId) return;
  if (!PROJECT_TYPES.includes(type as (typeof PROJECT_TYPES)[number])) return;

  await prisma.project.create({
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

  revalidatePath("/projects");
  revalidatePath("/");
}

export async function updateProject(formData: FormData) {
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const customerId = Number(formData.get("customerId"));
  const type = String(formData.get("type") ?? "ENGENHARIA");
  if (!id || !title || !customerId) return;

  await prisma.project.update({
    where: { id },
    data: {
      title,
      type: PROJECT_TYPES.includes(type as (typeof PROJECT_TYPES)[number]) ? type : "ENGENHARIA",
      customerId,
      responsibleId: Number(formData.get("responsibleId")) || null,
      value: num(formData.get("value")),
      location: str(formData.get("location")),
      startDate: date(formData.get("startDate")),
      endDate: date(formData.get("endDate")),
      notes: str(formData.get("notes")),
    },
  });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function setProjectStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !PROJECT_STATUSES.includes(status as (typeof PROJECT_STATUSES)[number])) return;

  await prisma.project.update({ where: { id }, data: { status } });
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function deleteProject(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.project.delete({ where: { id } });
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

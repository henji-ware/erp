"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { INSPECTION_STATUSES, RISK_LEVELS } from "@/lib/format";

export async function createInspection(formData: FormData) {
  const customerId = Number(formData.get("customerId"));
  const scheduledRaw = String(formData.get("scheduledAt") ?? "");
  if (!customerId || !scheduledRaw) return;

  await prisma.inspection.create({
    data: {
      customerId,
      scheduledAt: new Date(scheduledRaw),
      status: "AGENDADA",
      location: str(formData.get("location")),
      engineer: str(formData.get("engineer")),
      artNumber: str(formData.get("artNumber")),
      riskLevel: risk(formData.get("riskLevel")),
      findings: str(formData.get("findings")),
    },
  });

  revalidatePath("/inspections");
  revalidatePath("/");
}

export async function updateInspection(formData: FormData) {
  const id = Number(formData.get("id"));
  const customerId = Number(formData.get("customerId"));
  const scheduledRaw = String(formData.get("scheduledAt") ?? "");
  if (!id || !customerId || !scheduledRaw) return;

  await prisma.inspection.update({
    where: { id },
    data: {
      customerId,
      scheduledAt: new Date(scheduledRaw),
      location: str(formData.get("location")),
      engineer: str(formData.get("engineer")),
      artNumber: str(formData.get("artNumber")),
      riskLevel: risk(formData.get("riskLevel")),
      findings: str(formData.get("findings")),
    },
  });

  revalidatePath("/inspections");
  redirect("/inspections");
}

export async function setInspectionStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !INSPECTION_STATUSES.includes(status as (typeof INSPECTION_STATUSES)[number]))
    return;

  await prisma.inspection.update({ where: { id }, data: { status } });
  revalidatePath("/inspections");
  revalidatePath("/");
}

export async function deleteInspection(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.inspection.delete({ where: { id } });
  revalidatePath("/inspections");
  revalidatePath("/");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function risk(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return RISK_LEVELS.includes(s as (typeof RISK_LEVELS)[number]) ? s : null;
}

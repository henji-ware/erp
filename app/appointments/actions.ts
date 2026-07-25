"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { asEnum, APPOINTMENT_TYPES, APPOINTMENT_STATUSES } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEditRecord } from "@/lib/auth";

// Autorização: só o dono (ou admin) altera o agendamento.
async function allowed(id: number): Promise<boolean> {
  return canEditRecord(
    await prisma.appointment.findUnique({ where: { id }, select: { ownerId: true } }),
  );
}

export async function createAppointment(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const startsRaw = String(formData.get("startsAt") ?? "");
  if (!title || !startsRaw) return;

  const user = await getCurrentUser();
  const appt = await prisma.appointment.create({
    data: {
      title,
      type: asEnum(APPOINTMENT_TYPES, formData.get("type"), "MEETING"),
      startsAt: new Date(startsRaw),
      location: str(formData.get("location")),
      notes: str(formData.get("notes")),
      customerId: Number(formData.get("customerId")) || null,
      employeeId: Number(formData.get("employeeId")) || null,
      status: "SCHEDULED",
      ownerId: user?.id ?? null,
    },
  });
  await logAudit({ action: "CREATE", entity: "Agendamento", entityId: appt.id, summary: `"${title}" agendado` });

  revalidatePath("/appointments");
  revalidatePath("/");
}

export async function updateAppointment(formData: FormData) {
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const startsRaw = String(formData.get("startsAt") ?? "");
  if (!id || !title || !startsRaw) return;
  if (!(await allowed(id))) return;

  await prisma.appointment.update({
    where: { id },
    data: {
      title,
      type: asEnum(APPOINTMENT_TYPES, formData.get("type"), "MEETING"),
      startsAt: new Date(startsRaw),
      location: str(formData.get("location")),
      notes: str(formData.get("notes")),
      customerId: Number(formData.get("customerId")) || null,
      employeeId: Number(formData.get("employeeId")) || null,
    },
  });
  await logAudit({ action: "UPDATE", entity: "Agendamento", entityId: id, summary: `"${title}" editado` });

  revalidatePath("/appointments");
  redirect("/appointments");
}

export async function setAppointmentStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !APPOINTMENT_STATUSES.includes(status as (typeof APPOINTMENT_STATUSES)[number]))
    return;
  if (!(await allowed(id))) return;

  await prisma.appointment.update({
    where: { id },
    data: { status: asEnum(APPOINTMENT_STATUSES, status, "SCHEDULED") },
  });
  revalidatePath("/appointments");
  revalidatePath("/");
}

export async function deleteAppointment(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  if (!(await allowed(id))) return;
  await prisma.appointment.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entity: "Agendamento", entityId: id, summary: "Agendamento arquivado" });
  revalidatePath("/appointments");
  revalidatePath("/");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

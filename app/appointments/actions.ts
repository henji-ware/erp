"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { APPOINTMENT_TYPES, APPOINTMENT_STATUSES } from "@/lib/format";

export async function createAppointment(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "MEETING");
  const startsRaw = String(formData.get("startsAt") ?? "");
  if (!title || !startsRaw) return;
  if (!APPOINTMENT_TYPES.includes(type as (typeof APPOINTMENT_TYPES)[number])) return;

  await prisma.appointment.create({
    data: {
      title,
      type,
      startsAt: new Date(startsRaw),
      location: str(formData.get("location")),
      notes: str(formData.get("notes")),
      customerId: Number(formData.get("customerId")) || null,
      employeeId: Number(formData.get("employeeId")) || null,
      status: "SCHEDULED",
    },
  });

  revalidatePath("/appointments");
  revalidatePath("/");
}

export async function updateAppointment(formData: FormData) {
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "MEETING");
  const startsRaw = String(formData.get("startsAt") ?? "");
  if (!id || !title || !startsRaw) return;

  await prisma.appointment.update({
    where: { id },
    data: {
      title,
      type,
      startsAt: new Date(startsRaw),
      location: str(formData.get("location")),
      notes: str(formData.get("notes")),
      customerId: Number(formData.get("customerId")) || null,
      employeeId: Number(formData.get("employeeId")) || null,
    },
  });

  revalidatePath("/appointments");
  redirect("/appointments");
}

export async function setAppointmentStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !APPOINTMENT_STATUSES.includes(status as (typeof APPOINTMENT_STATUSES)[number]))
    return;

  await prisma.appointment.update({ where: { id }, data: { status } });
  revalidatePath("/appointments");
  revalidatePath("/");
}

export async function deleteAppointment(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.appointment.delete({ where: { id } });
  revalidatePath("/appointments");
  revalidatePath("/");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

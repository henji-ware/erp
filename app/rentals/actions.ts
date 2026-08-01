"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { asEnum, RENTAL_STATUSES, RENTAL_STATUS_LABELS } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEditRecord } from "@/lib/auth";

// Autorização: só o dono (ou admin) altera a locação.
async function allowed(id: number): Promise<boolean> {
  return canEditRecord(await prisma.rental.findUnique({ where: { id }, select: { ownerId: true } }));
}

export async function createRental(formData: FormData) {
  const customerId = Number(formData.get("customerId"));
  const productId = Number(formData.get("productId"));
  const startRaw = String(formData.get("startDate") ?? "");
  if (!customerId || !productId || !startRaw) return;

  const user = await getCurrentUser();
  const rental = await prisma.rental.create({
    data: {
      number: "LOC-" + Date.now().toString(36).toUpperCase(),
      customerId,
      productId,
      quantity: Math.max(1, int(formData.get("quantity"))),
      monthlyRate: num(formData.get("monthlyRate")),
      startDate: new Date(startRaw),
      expectedEnd: date(formData.get("expectedEnd")),
      status: "ACTIVE",
      deliveryAddress: str(formData.get("deliveryAddress")),
      refCode: str(formData.get("refCode")),
      notes: str(formData.get("notes")),
      ownerId: user?.id ?? null,
    },
  });
  await logAudit({ action: "CREATE", entity: "Locação", entityId: rental.id, summary: `Locação ${rental.number} criada` });

  revalidatePath("/rentals");
  revalidatePath("/");
}

export async function setRentalStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !RENTAL_STATUSES.includes(status as (typeof RENTAL_STATUSES)[number])) return;
  if (!(await allowed(id))) return;

  const rental = await prisma.rental.findUnique({
    where: { id },
    select: { returnedAt: true },
  });
  if (!rental) return;

  await prisma.rental.update({
    where: { id },
    data: {
      status: asEnum(RENTAL_STATUSES, status, "ACTIVE"),
      // Ao marcar como devolvido, registra a data — mas preserva a data já
      // gravada, senão reenviar o status trocaria a devolução para hoje.
      returnedAt:
        status === "RETURNED" ? (rental.returnedAt ?? new Date()) : null,
    },
  });
  await logAudit({ action: "STATUS", entity: "Locação", entityId: id, summary: `Status → ${RENTAL_STATUS_LABELS[status]}` });
  revalidatePath("/rentals");
  revalidatePath("/");
}

export async function deleteRental(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  if (!(await allowed(id))) return;
  await prisma.rental.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entity: "Locação", entityId: id, summary: "Locação arquivada" });
  revalidatePath("/rentals");
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
function int(v: FormDataEntryValue | null): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}
function date(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  return s ? new Date(s) : null;
}

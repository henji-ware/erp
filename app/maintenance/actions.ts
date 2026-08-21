"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  asEnum,
  MAINTENANCE_FREQUENCIES,
  MAINTENANCE_FREQUENCY_DAYS,
  MAINTENANCE_STATUSES,
} from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEditRecord } from "@/lib/auth";
import { parseMoney } from "@/lib/money";

// Autorização: só o dono (ou admin) altera o contrato.
async function allowed(id: number): Promise<boolean> {
  return canEditRecord(
    await prisma.maintenanceContract.findUnique({ where: { id }, select: { ownerId: true } }),
  );
}

export async function createMaintenance(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const customerId = Number(formData.get("customerId"));
  if (!title || !customerId) return;

  const user = await getCurrentUser();
  const contract = await prisma.maintenanceContract.create({
    data: {
      title,
      customerId,
      frequency: asEnum(MAINTENANCE_FREQUENCIES, formData.get("frequency"), "MONTHLY"),
      value: num(formData.get("value")),
      nextVisit: date(formData.get("nextVisit")),
      status: "ACTIVE",
      refCode: str(formData.get("refCode")),
      notes: str(formData.get("notes")),
      ownerId: user?.id ?? null,
    },
  });
  await logAudit({ action: "CREATE", entity: "Manutenção", entityId: contract.id, summary: `Contrato "${title}" criado` });

  revalidatePath("/maintenance");
  revalidatePath("/");
}

export async function setMaintenanceStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !MAINTENANCE_STATUSES.includes(status as (typeof MAINTENANCE_STATUSES)[number])) return;
  if (!(await allowed(id))) return;

  await prisma.maintenanceContract.update({
    where: { id },
    data: { status: asEnum(MAINTENANCE_STATUSES, status, "ACTIVE") },
  });
  revalidatePath("/maintenance");
  revalidatePath("/");
}

// Registra que a visita foi feita e agenda a próxima conforme a frequência.
export async function completeVisit(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  if (!(await allowed(id))) return;
  const c = await prisma.maintenanceContract.findUnique({ where: { id } });
  if (!c) return;

  // A visita acabou de ser feita: conta a partir de hoje quando o contrato já
  // estava atrasado, senão a próxima cairia numa data passada e continuaria
  // vencida. Em dia, mantém a cadência do cronograma.
  const now = new Date();
  const base = c.nextVisit && c.nextVisit > now ? c.nextVisit : now;
  const days = MAINTENANCE_FREQUENCY_DAYS[c.frequency] ?? 30;
  const next = new Date(base);
  next.setDate(next.getDate() + days);

  await prisma.maintenanceContract.update({ where: { id }, data: { nextVisit: next } });
  await logAudit({ action: "STATUS", entity: "Manutenção", entityId: id, summary: "Visita registrada — próxima reagendada" });
  revalidatePath("/maintenance");
  revalidatePath("/");
}

export async function deleteMaintenance(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  if (!(await allowed(id))) return;
  await prisma.maintenanceContract.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entity: "Manutenção", entityId: id, summary: "Contrato arquivado" });
  revalidatePath("/maintenance");
  revalidatePath("/");
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

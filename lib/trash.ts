import { prisma } from "./prisma";
import { TRASH_TTL_DAYS } from "./format";

// Limpeza permanente isolada da renderização de páginas. Cada modelo é
// independente porque vínculos ainda existentes podem impedir só uma classe
// de exclusão sem bloquear as demais.
export async function purgeExpiredTrash(): Promise<Record<string, number>> {
  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 86400000);
  const where = { deletedAt: { lt: cutoff } };
  const removed: Record<string, number> = {};

  const jobs: [string, () => Promise<{ count: number }>][] = [
    ["transactions", () => prisma.transaction.deleteMany({ where })],
    ["orders", () => prisma.order.deleteMany({ where })],
    ["inspections", () => prisma.inspection.deleteMany({ where })],
    ["appointments", () => prisma.appointment.deleteMany({ where })],
    ["rentals", () => prisma.rental.deleteMany({ where })],
    ["maintenance", () => prisma.maintenanceContract.deleteMany({ where })],
    ["leads", () => prisma.lead.deleteMany({ where })],
    ["projects", () => prisma.project.deleteMany({ where })],
    ["customers", () => prisma.customer.deleteMany({ where })],
    ["products", () => prisma.product.deleteMany({ where })],
    ["suppliers", () => prisma.supplier.deleteMany({ where })],
  ];

  for (const [name, run] of jobs) {
    try {
      removed[name] = (await run()).count;
    } catch {
      removed[name] = 0;
    }
  }
  return removed;
}


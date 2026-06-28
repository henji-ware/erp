"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canEdit } from "@/lib/auth";

type Entity =
  | "customer"
  | "project"
  | "inspection"
  | "order"
  | "appointment"
  | "rental"
  | "maintenanceContract"
  | "transaction"
  | "lead";

const PATHS: Record<Entity, string> = {
  customer: "/customers",
  project: "/projects",
  inspection: "/inspections",
  order: "/orders",
  appointment: "/appointments",
  rental: "/rentals",
  maintenanceContract: "/maintenance",
  transaction: "/finance",
  lead: "/leads",
};

// Marca/desmarca um registro como compartilhado (visível a todos os usuários).
// Só o dono ou um admin pode alterar.
export async function toggleShared(formData: FormData) {
  const entity = String(formData.get("entity") ?? "") as Entity;
  const id = Number(formData.get("id"));
  const shared = String(formData.get("shared")) === "true";
  if (!PATHS[entity] || !id) return;

  const user = await getCurrentUser();

  let rec: { ownerId: number | null } | null = null;
  switch (entity) {
    case "customer": rec = await prisma.customer.findUnique({ where: { id }, select: { ownerId: true } }); break;
    case "project": rec = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } }); break;
    case "inspection": rec = await prisma.inspection.findUnique({ where: { id }, select: { ownerId: true } }); break;
    case "order": rec = await prisma.order.findUnique({ where: { id }, select: { ownerId: true } }); break;
    case "appointment": rec = await prisma.appointment.findUnique({ where: { id }, select: { ownerId: true } }); break;
    case "rental": rec = await prisma.rental.findUnique({ where: { id }, select: { ownerId: true } }); break;
    case "maintenanceContract": rec = await prisma.maintenanceContract.findUnique({ where: { id }, select: { ownerId: true } }); break;
    case "transaction": rec = await prisma.transaction.findUnique({ where: { id }, select: { ownerId: true } }); break;
    case "lead": rec = await prisma.lead.findUnique({ where: { id }, select: { ownerId: true } }); break;
  }
  if (!rec || !canEdit(user, rec)) return;

  switch (entity) {
    case "customer": await prisma.customer.update({ where: { id }, data: { shared } }); break;
    case "project": await prisma.project.update({ where: { id }, data: { shared } }); break;
    case "inspection": await prisma.inspection.update({ where: { id }, data: { shared } }); break;
    case "order": await prisma.order.update({ where: { id }, data: { shared } }); break;
    case "appointment": await prisma.appointment.update({ where: { id }, data: { shared } }); break;
    case "rental": await prisma.rental.update({ where: { id }, data: { shared } }); break;
    case "maintenanceContract": await prisma.maintenanceContract.update({ where: { id }, data: { shared } }); break;
    case "transaction": await prisma.transaction.update({ where: { id }, data: { shared } }); break;
    case "lead": await prisma.lead.update({ where: { id }, data: { shared } }); break;
  }

  revalidatePath(PATHS[entity]);
  revalidatePath("/");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { SELLER_CATEGORIES } from "@/lib/format";

export async function createEmployee(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const employee = await prisma.employee.create({
    data: {
      name,
      role: str(formData.get("role")),
      department: str(formData.get("department")),
      category: category(formData.get("category")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      contractType: contract(formData.get("contractType")),
      salary: num(formData.get("salary")),
      commissionPct: num(formData.get("commissionPct")),
      targetValue: optNum(formData.get("targetValue")),
      targetQty: optInt(formData.get("targetQty")),
      benefits: str(formData.get("benefits")),
      hireDate: date(formData.get("hireDate")),
      active: true,
    },
  });
  await logAudit({ action: "CREATE", entity: "Funcionário", entityId: employee.id, summary: `"${name}" cadastrado` });

  revalidatePath("/hr");
}

export async function updateEmployee(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  await prisma.employee.update({
    where: { id },
    data: {
      name,
      role: str(formData.get("role")),
      department: str(formData.get("department")),
      category: category(formData.get("category")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      contractType: contract(formData.get("contractType")),
      salary: num(formData.get("salary")),
      commissionPct: num(formData.get("commissionPct")),
      targetValue: optNum(formData.get("targetValue")),
      targetQty: optInt(formData.get("targetQty")),
      benefits: str(formData.get("benefits")),
      hireDate: date(formData.get("hireDate")),
      active: formData.get("active") === "on",
    },
  });
  await logAudit({ action: "UPDATE", entity: "Funcionário", entityId: id, summary: `"${name}" editado` });

  revalidatePath("/hr");
  redirect("/hr");
}

export async function deleteEmployee(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.employee.delete({ where: { id } });
  await logAudit({ action: "DELETE", entity: "Funcionário", entityId: id, summary: "Funcionário excluído" });
  revalidatePath("/hr");
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
function contract(v: FormDataEntryValue | null): "CLT" | "PJ" {
  return String(v ?? "") === "PJ" ? "PJ" : "CLT";
}
function category(v: FormDataEntryValue | null): (typeof SELLER_CATEGORIES)[number] | null {
  const s = String(v ?? "").trim();
  return SELLER_CATEGORIES.includes(s as (typeof SELLER_CATEGORIES)[number])
    ? (s as (typeof SELLER_CATEGORIES)[number])
    : null;
}
function optNum(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function optInt(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

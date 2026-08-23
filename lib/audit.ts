import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "STATUS";

// Registra uma entrada no log de auditoria. Identifica o usuário logado
// automaticamente. Nunca lança erro — a auditoria jamais deve quebrar a
// operação principal (a gravação do registro de negócio).
export async function logAudit(entry: {
  action: AuditAction;
  entity: string;
  entityId?: number | null;
  summary?: string;
}): Promise<void> {
  try {
    const user = await getCurrentUser();
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userName: user?.name ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary ?? null,
      },
    });
  } catch {
    /* auditoria é "best effort" — ignora falhas */
  }
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: "Criou",
  UPDATE: "Editou",
  DELETE: "Excluiu",
  STATUS: "Mudou status",
};

export const AUDIT_ACTION_COLORS: Record<string, string> = {
  CREATE: "badge-tone badge-success",
  UPDATE: "badge-tone badge-info",
  DELETE: "badge-tone badge-danger",
  STATUS: "badge-tone badge-warn",
};

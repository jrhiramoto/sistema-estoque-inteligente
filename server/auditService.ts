import { getDb } from "./db";
import { auditLogs, InsertAuditLog } from "../drizzle/schema";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";

export type AuditAction =
  | "login"
  | "logout"
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "password_changed"
  | "password_reset"
  | "permission_granted"
  | "permission_revoked";

export interface AuditLogParams {
  userId?: number;
  action: AuditAction;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  targetUserId?: number;
}

/**
 * Registra uma ação de auditoria
 */
export async function logAction(params: AuditLogParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Audit] Database not available, skipping log");
      return;
    }

    const logData: InsertAuditLog = {
      userId: params.userId,
      action: params.action,
      details: params.details ? JSON.stringify(params.details) : null,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      targetUserId: params.targetUserId,
    };

    await db.insert(auditLogs).values(logData);
    console.log(`[Audit] Logged action: ${params.action} by user ${params.userId || "system"}`);
  } catch (error) {
    console.error("[Audit] Failed to log action:", error);
    // Não lançar erro para não interromper o fluxo principal
  }
}

/**
 * Lista logs de auditoria com filtros e paginação
 */
export async function listAuditLogs(params: {
  userId?: number;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { userId, action, startDate, endDate, limit = 50, offset = 0 } = params;

  // Construir condições de filtro
  const conditions = [];
  if (userId) {
    conditions.push(eq(auditLogs.userId, userId));
  }
  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }
  if (startDate) {
    conditions.push(gte(auditLogs.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(auditLogs.createdAt, endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Buscar logs
  const logs = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  // Contar total
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(whereClause);

  return {
    logs: logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    })),
    total: count,
    limit,
    offset,
  };
}

/**
 * Busca logs de um usuário específico
 */
export async function getUserAuditLogs(userId: number, limit: number = 20) {
  return listAuditLogs({ userId, limit });
}

/**
 * Busca logs de uma ação específica
 */
export async function getActionLogs(action: AuditAction, limit: number = 50) {
  return listAuditLogs({ action, limit });
}

/**
 * Limpa logs antigos (manutenção)
 */
export async function cleanOldLogs(daysToKeep: number = 90): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await db
    .delete(auditLogs)
    .where(lte(auditLogs.createdAt, cutoffDate));

  console.log(`[Audit] Cleaned logs older than ${daysToKeep} days`);
  return 0; // Drizzle não retorna rowCount diretamente
}

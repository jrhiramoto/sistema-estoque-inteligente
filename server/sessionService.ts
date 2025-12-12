import { getDb } from "./db";
import { userSessions, InsertUserSession } from "../drizzle/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import crypto from "crypto";

/**
 * Cria uma nova sessão para o usuário
 */
export async function createSession(params: {
  userId: number;
  ipAddress?: string;
  userAgent?: string;
  expiresInDays?: number;
}): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { userId, ipAddress, userAgent, expiresInDays = 30 } = params;

  // Gerar token único
  const token = crypto.randomBytes(32).toString("hex");

  // Calcular data de expiração
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Extrair informações do dispositivo do user-agent
  const deviceInfo = extractDeviceInfo(userAgent);

  const sessionData: InsertUserSession = {
    userId,
    token,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
    expiresAt,
  };

  await db.insert(userSessions).values(sessionData);

  console.log(`[Session] Created session for user ${userId}`);
  return token;
}

/**
 * Valida e atualiza atividade de uma sessão
 */
export async function validateSession(token: string): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const now = new Date();

  // Buscar sessão válida
  const [session] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.token, token), gte(userSessions.expiresAt, now)))
    .limit(1);

  if (!session) {
    return null;
  }

  // Atualizar última atividade
  await db
    .update(userSessions)
    .set({ lastActivity: now })
    .where(eq(userSessions.id, session.id));

  return session.userId;
}

/**
 * Lista sessões ativas de um usuário
 */
export async function getUserSessions(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();

  const sessions = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), gte(userSessions.expiresAt, now)));

  return sessions.map((session) => ({
    ...session,
    deviceInfo: session.deviceInfo ? JSON.parse(session.deviceInfo) : null,
  }));
}

/**
 * Desconecta uma sessão específica
 */
export async function revokeSession(sessionId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Verificar se a sessão pertence ao usuário
  const [session] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, userId)))
    .limit(1);

  if (!session) {
    return false;
  }

  // Deletar sessão
  await db.delete(userSessions).where(eq(userSessions.id, sessionId));

  console.log(`[Session] Revoked session ${sessionId} for user ${userId}`);
  return true;
}

/**
 * Desconecta todas as sessões de um usuário exceto a atual
 */
export async function revokeOtherSessions(
  userId: number,
  currentToken: string
): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Buscar sessão atual
  const [currentSession] = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.token, currentToken))
    .limit(1);

  if (!currentSession) {
    throw new Error("Current session not found");
  }

  // Deletar todas as outras sessões
  await db
    .delete(userSessions)
    .where(
      and(eq(userSessions.userId, userId), eq(userSessions.id, currentSession.id))
    );

  console.log(`[Session] Revoked all other sessions for user ${userId}`);
  return 0; // Drizzle não retorna rowCount diretamente
}

/**
 * Desconecta todas as sessões de um usuário
 */
export async function revokeAllUserSessions(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(userSessions).where(eq(userSessions.userId, userId));

  console.log(`[Session] Revoked all sessions for user ${userId}`);
}

/**
 * Limpa sessões expiradas (manutenção)
 */
export async function cleanExpiredSessions(): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();

  await db.delete(userSessions).where(lt(userSessions.expiresAt, now));

  console.log("[Session] Cleaned expired sessions");
  return 0;
}

/**
 * Extrai informações do dispositivo do user-agent
 */
function extractDeviceInfo(userAgent?: string | null): Record<string, string> | null {
  if (!userAgent) return null;

  const info: Record<string, string> = {};

  // Detectar navegador
  if (userAgent.includes("Chrome")) info.browser = "Chrome";
  else if (userAgent.includes("Firefox")) info.browser = "Firefox";
  else if (userAgent.includes("Safari")) info.browser = "Safari";
  else if (userAgent.includes("Edge")) info.browser = "Edge";
  else info.browser = "Unknown";

  // Detectar SO
  if (userAgent.includes("Windows")) info.os = "Windows";
  else if (userAgent.includes("Mac")) info.os = "macOS";
  else if (userAgent.includes("Linux")) info.os = "Linux";
  else if (userAgent.includes("Android")) info.os = "Android";
  else if (userAgent.includes("iOS")) info.os = "iOS";
  else info.os = "Unknown";

  // Detectar tipo de dispositivo
  if (userAgent.includes("Mobile")) info.deviceType = "Mobile";
  else if (userAgent.includes("Tablet")) info.deviceType = "Tablet";
  else info.deviceType = "Desktop";

  return info;
}

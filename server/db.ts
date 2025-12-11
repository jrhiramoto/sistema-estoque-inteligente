import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  InsertUser, users,
  User
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Função para resetar cache de conexão
export function resetDbConnection() {
  console.log("[Database] Resetando cache de conexão...");
  _db = null;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      console.log("[Database] Creating new connection to Supabase Postgres...");
      
      // Criar cliente Postgres
      const client = postgres(process.env.DATABASE_URL, {
        ssl: 'require',
        max: 10,
      });
      
      _db = drizzle(client);
      console.log("[Database] Connection created successfully!");
    } catch (error) {
      console.warn("[Database] Failed to create connection:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== User Management =====

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // Postgres: INSERT ... ON CONFLICT DO UPDATE
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Autenticação Email/Senha =====

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserWithPassword(data: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<User> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(users).values({
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    loginMethod: 'email',
    role: 'user',
    lastSignedIn: new Date(),
  }).returning();

  return result[0];
}

export async function createUserWithGoogle(data: {
  openId: string;
  name: string;
  email: string;
}): Promise<User> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Verificar se é o owner
  const role = data.openId === ENV.ownerOpenId ? 'admin' : 'user';

  const result = await db.insert(users).values({
    openId: data.openId,
    name: data.name,
    email: data.email,
    loginMethod: 'google',
    role,
    lastSignedIn: new Date(),
  }).returning();

  return result[0];
}

export async function updateUserLastSignedIn(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user: database not available");
    return;
  }

  await db.update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

// ===== Vinculação de Contas (Account Linking) =====

/**
 * Vincula Google OAuth a uma conta existente
 * Usado quando usuário tem conta email/senha e faz login com Google
 */
export async function linkGoogleToUser(userId: number, openId: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Atualizar loginMethod para incluir google
  const currentMethods = user.loginMethod?.split(',') || [];
  if (!currentMethods.includes('google')) {
    currentMethods.push('google');
  }

  await db.update(users)
    .set({ 
      openId,
      loginMethod: currentMethods.join(','),
      lastSignedIn: new Date()
    })
    .where(eq(users.id, userId));
}

/**
 * Vincula senha a uma conta existente (criada via Google)
 * Usado quando usuário tem conta Google e quer adicionar senha
 */
export async function linkPasswordToUser(userId: number, passwordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Atualizar loginMethod para incluir email
  const currentMethods = user.loginMethod?.split(',') || [];
  if (!currentMethods.includes('email')) {
    currentMethods.push('email');
  }

  await db.update(users)
    .set({ 
      passwordHash,
      loginMethod: currentMethods.join(','),
    })
    .where(eq(users.id, userId));
}

/**
 * Busca usuário por openId do Google
 */
export async function getUserByGoogleId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// TODO: Migrar outras funções do db.ts original conforme necessário

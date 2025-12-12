import { eq, sql, or, like, desc } from "drizzle-orm";
import { users, InsertUser, User } from "../drizzle/schema";
import { getDb } from "./db";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/**
 * Cria novo usuário
 */
export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role?: "user" | "admin" | "master";
  permissions?: string[];
}): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Hash da senha
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  // Verificar se é o primeiro usuário (será master)
  const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
  const isFirstUser = Number(userCount[0]?.count) === 0;

  const newUser: InsertUser = {
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash,
    role: isFirstUser ? "master" : (data.role || "user"),
    permissions: JSON.stringify(data.permissions || []),
    lastSignedIn: new Date(),
  };

  const result = await db.insert(users).values(newUser).returning();
  return result[0];
}

/**
 * Busca usuário por email
 */
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  return result[0];
}

/**
 * Busca usuário por ID
 */
export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return result[0];
}

/**
 * Lista todos os usuários (com paginação e busca)
 */
export async function listUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ users: User[]; total: number }> {
  const db = await getDb();
  if (!db) return { users: [], total: 0 };

  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const offset = (page - 1) * limit;

  let query = db.select().from(users);

  // Busca por nome ou email
  if (params?.search) {
    const searchTerm = `%${params.search}%`;
    query = query.where(
      or(
        like(users.name, searchTerm),
        like(users.email, searchTerm)
      )
    ) as any;
  }

  // Ordenar por data de criação (mais recentes primeiro)
  const result = await query
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  // Contar total
  const countQuery = db.select({ count: sql<number>`count(*)` }).from(users);
  const totalResult = params?.search
    ? await countQuery.where(
        or(
          like(users.name, `%${params.search}%`),
          like(users.email, `%${params.search}%`)
        )
      )
    : await countQuery;

  return {
    users: result,
    total: Number(totalResult[0]?.count || 0),
  };
}

/**
 * Atualiza usuário
 */
export async function updateUser(
  id: number,
  data: {
    name?: string;
    email?: string;
    role?: "user" | "admin" | "master";
    permissions?: string[];
  }
): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.role !== undefined) updateData.role = data.role;
  if (data.permissions !== undefined) {
    updateData.permissions = JSON.stringify(data.permissions);
  }

  const result = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning();

  if (!result[0]) throw new Error("User not found");
  return result[0];
}

/**
 * Reseta senha do usuário
 */
export async function resetUserPassword(
  id: number,
  newPassword: string
): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const result = await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (!result[0]) throw new Error("User not found");
  return result[0];
}

/**
 * Deleta usuário
 */
export async function deleteUser(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(users).where(eq(users.id, id));
}

/**
 * Verifica senha
 */
export async function verifyPassword(
  email: string,
  password: string
): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;

  // Atualizar lastSignedIn
  const db = await getDb();
  if (db) {
    await db
      .update(users)
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, user.id));
  }

  return user;
}

/**
 * Concede permissão a um usuário
 */
export async function grantPermission(
  userId: number,
  permission: string
): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const currentPermissions = JSON.parse(user.permissions || "[]");
  if (!currentPermissions.includes(permission)) {
    currentPermissions.push(permission);
  }

  const result = await db
    .update(users)
    .set({
      permissions: JSON.stringify(currentPermissions),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return result[0];
}

/**
 * Revoga permissão de um usuário
 */
export async function revokePermission(
  userId: number,
  permission: string
): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const currentPermissions = JSON.parse(user.permissions || "[]");
  const updatedPermissions = currentPermissions.filter((p: string) => p !== permission);

  const result = await db
    .update(users)
    .set({
      permissions: JSON.stringify(updatedPermissions),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return result[0];
}

/**
 * Verifica se usuário tem permissão específica
 */
export function hasPermission(user: User, permission: string): boolean {
  // Master tem todas as permissões
  if (user.role === "master") return true;

  const permissions = JSON.parse(user.permissions || "[]");
  return permissions.includes(permission);
}

/**
 * Verifica se usuário pode gerenciar outros usuários
 */
export function canManageUsers(user: User): boolean {
  return user.role === "master" || hasPermission(user, "manage_users");
}

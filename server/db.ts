import { eq, desc, and, gte, lte, sql, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, products, inventory, sales, 
  inventoryCounts, alerts, countSchedule, blingConfig,
  Product, Inventory, Sale, Alert, InventoryCount, CountSchedule, BlingConfig
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== Bling Configuration =====

export async function getBlingConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(blingConfig)
    .where(eq(blingConfig.userId, userId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function upsertBlingConfig(config: Partial<BlingConfig> & { userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getBlingConfig(config.userId);
  
  if (existing) {
    await db.update(blingConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(blingConfig.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(blingConfig).values(config as any);
    return result[0].insertId;
  }
}

// ===== Products =====

export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(products).where(eq(products.isActive, true));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProductByBlingId(blingId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(products).where(eq(products.blingId, blingId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertProduct(product: Partial<Product> & { blingId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getProductByBlingId(product.blingId);
  
  if (existing) {
    await db.update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(products).values(product as any);
    return result[0].insertId;
  }
}

export async function getProductsByABCClass(abcClass: "A" | "B" | "C") {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(products)
    .where(and(
      eq(products.abcClass, abcClass),
      eq(products.isActive, true)
    ));
}

// ===== Inventory =====

export async function getInventoryByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(inventory).where(eq(inventory.productId, productId));
}

export async function getTotalInventoryByProduct(productId: number) {
  const db = await getDb();
  if (!db) return { virtual: 0, physical: 0, reserved: 0 };
  
  const result = await db.select({
    virtual: sql<number>`SUM(${inventory.virtualStock})`,
    physical: sql<number>`SUM(${inventory.physicalStock})`,
    reserved: sql<number>`SUM(${inventory.reservedStock})`,
  }).from(inventory).where(eq(inventory.productId, productId));
  
  return result[0] || { virtual: 0, physical: 0, reserved: 0 };
}

export async function upsertInventory(inv: Partial<Inventory> & { productId: number; depositId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const depositIdValue = inv.depositId || "default";
  
  const existing = await db.select().from(inventory)
    .where(and(
      eq(inventory.productId, inv.productId),
      eq(inventory.depositId, depositIdValue)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(inventory)
      .set({ ...inv, updatedAt: new Date() })
      .where(eq(inventory.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(inventory).values({ ...inv, depositId: depositIdValue } as any);
    return result[0].insertId;
  }
}

// ===== Sales =====

export async function getSalesByProduct(productId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(sales.productId, productId)];
  
  if (startDate && endDate) {
    conditions.push(gte(sales.saleDate, startDate));
    conditions.push(lte(sales.saleDate, endDate));
  }
  
  return await db.select().from(sales)
    .where(and(...conditions))
    .orderBy(desc(sales.saleDate));
}

export async function insertSale(sale: Omit<Sale, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(sales).values(sale as any);
  return result[0].insertId;
}

export async function calculateAvgSales12Months(productId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  const result = await db.select({
    total: sql<number>`SUM(${sales.quantity})`,
  }).from(sales)
    .where(and(
      eq(sales.productId, productId),
      gte(sales.saleDate, twelveMonthsAgo)
    ));
  
  const totalSales = result[0]?.total || 0;
  return Math.round(totalSales / 12);
}

// ===== Inventory Counts =====

export async function getInventoryCountsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(inventoryCounts)
    .where(eq(inventoryCounts.productId, productId))
    .orderBy(desc(inventoryCounts.countDate));
}

export async function insertInventoryCount(count: Omit<InventoryCount, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(inventoryCounts).values(count as any);
  return result[0].insertId;
}

// ===== Alerts =====

export async function getActiveAlerts() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(alerts)
    .where(and(
      eq(alerts.isResolved, false)
    ))
    .orderBy(desc(alerts.createdAt));
}

export async function getAlertsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(alerts)
    .where(eq(alerts.productId, productId))
    .orderBy(desc(alerts.createdAt));
}

export async function insertAlert(alert: Omit<Alert, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(alerts).values(alert as any);
  return result[0].insertId;
}

export async function markAlertResolved(alertId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(alerts)
    .set({
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy: userId,
    })
    .where(eq(alerts.id, alertId));
}

// ===== Count Schedule =====

export async function getCountScheduleByProduct(productId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(countSchedule)
    .where(and(
      eq(countSchedule.productId, productId),
      eq(countSchedule.isActive, true)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function getDueCountSchedules() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(countSchedule)
    .where(and(
      eq(countSchedule.isActive, true),
      lte(countSchedule.nextCountDate, new Date())
    ));
}

export async function upsertCountSchedule(schedule: Partial<CountSchedule> & { productId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getCountScheduleByProduct(schedule.productId);
  
  if (existing) {
    await db.update(countSchedule)
      .set({ ...schedule, updatedAt: new Date() })
      .where(eq(countSchedule.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(countSchedule).values(schedule as any);
    return result[0].insertId;
  }
}

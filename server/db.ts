import { eq, desc, and, gte, lte, sql, isNull, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, products, inventory, sales, 
  inventoryCounts, alerts, countSchedule, blingConfig,
  syncHistory, syncConfig, apiUsageLog, webhookEvents,
  productSuppliers,
  Product, Inventory, Sale, Alert, InventoryCount, CountSchedule, BlingConfig,
  InsertSyncHistory, InsertSyncConfig, SyncHistory, SyncConfig,
  ApiUsageLog, InsertApiUsageLog, WebhookEvent, InsertWebhookEvent,
  ProductSupplier, InsertProductSupplier
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
  
  return await db.select().from(products);
}

export async function getProductsPaginated(params: {
  abcClass?: "A" | "B" | "C";
  search?: string;
  limit: number;
  offset: number;
}) {
  const db = await getDb();
  if (!db) return { products: [], total: 0 };
  
  const { abcClass, search, limit, offset } = params;
  
  // Construir condições
  const conditions = [];
  
  if (abcClass) {
    conditions.push(eq(products.abcClass, abcClass));
  }
  
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      or(
        like(products.name, searchTerm),
        like(products.code, searchTerm)
      )
    );
  }
  
  // Query com filtros
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Buscar produtos paginados com estoque
  const productsList = await db.select({
      id: products.id,
      blingId: products.blingId,
      code: products.code,
      name: products.name,
      description: products.description,
      price: products.price,
      cost: products.cost,
      unit: products.unit,
      abcClass: products.abcClass,
      abcClassManual: products.abcClassManual,
      shouldStock: products.shouldStock,
      minStock: products.minStock,
      maxStock: products.maxStock,
      reorderPoint: products.reorderPoint,
      safetyStock: products.safetyStock,
      avgSales12Months: products.avgSales12Months,
      suggestedOrderQty: products.suggestedOrderQty,
      lastSaleDate: products.lastSaleDate,
      isActive: products.isActive,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      virtualStock: sql<number>`COALESCE(SUM(${inventory.virtualStock}), 0)`,
      physicalStock: sql<number>`COALESCE(SUM(${inventory.physicalStock}), 0)`,
    })
    .from(products)
    .leftJoin(inventory, eq(products.id, inventory.productId))
    .where(whereClause)
    .groupBy(products.id)
    .limit(limit)
    .offset(offset)
    .orderBy(products.name);
  
  // Contar total (para paginação)
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(products)
    .where(whereClause);
  
  const total = countResult[0]?.count || 0;
  
  return {
    products: productsList,
    total,
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(total / limit),
  };
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
  
  const result = await db.select().from(products)
    .where(eq(products.blingId, blingId))
    .limit(1);
  
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

// ===== Sync History =====

export async function createSyncHistory(history: InsertSyncHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(syncHistory).values(history);
  return result[0].insertId;
}

export async function updateSyncHistory(id: number, updates: Partial<SyncHistory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(syncHistory).set(updates).where(eq(syncHistory.id, id));
}

export async function getRecentSyncHistory(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(syncHistory).orderBy(desc(syncHistory.startedAt)).limit(limit);
}

export async function getLastSuccessfulSync(userId: number, syncType: 'products' | 'inventory' | 'sales' | 'full') {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(syncHistory)
    .where(and(
      eq(syncHistory.syncType, syncType),
      eq(syncHistory.status, 'completed'),
      isNull(syncHistory.errorMessage)
    ))
    .orderBy(desc(syncHistory.completedAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// ===== Sync Config =====

export async function getSyncConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(syncConfig).where(eq(syncConfig.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertSyncConfig(config: InsertSyncConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getSyncConfig(config.userId);
  
  if (existing) {
    await db.update(syncConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(syncConfig.userId, config.userId));
  } else {
    await db.insert(syncConfig).values(config);
  }
}


// ===== API Usage Tracking =====

export async function logApiUsage(log: InsertApiUsageLog) {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.insert(apiUsageLog).values(log);
  } catch (error) {
    console.error('[Database] Error logging API usage:', error);
  }
}

export async function getApiUsageToday(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return db.select().from(apiUsageLog)
    .where(and(
      eq(apiUsageLog.userId, userId),
      gte(apiUsageLog.timestamp, today)
    ))
    .orderBy(desc(apiUsageLog.timestamp));
}

export async function getApiUsageStats(userId: number, days: number = 7) {
  const db = await getDb();
  if (!db) return null;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  
  const logs = await db.select().from(apiUsageLog)
    .where(and(
      eq(apiUsageLog.userId, userId),
      gte(apiUsageLog.timestamp, startDate)
    ));
  
  const totalRequests = logs.length;
  const rateLimitErrors = logs.filter(l => l.isRateLimitError).length;
  const avgResponseTime = logs.length > 0 
    ? logs.reduce((sum, l) => sum + (l.responseTime || 0), 0) / logs.length 
    : 0;
  
  // Agrupar por dia
  const byDay: Record<string, number> = {};
  logs.forEach(log => {
    const day = log.timestamp.toISOString().split('T')[0];
    byDay[day] = (byDay[day] || 0) + 1;
  });
  
  return {
    totalRequests,
    rateLimitErrors,
    avgResponseTime: Math.round(avgResponseTime),
    byDay,
    dailyAverage: Math.round(totalRequests / days),
  };
}

export async function getRecentRateLimitErrors(userId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(apiUsageLog)
    .where(and(
      eq(apiUsageLog.userId, userId),
      eq(apiUsageLog.isRateLimitError, true)
    ))
    .orderBy(desc(apiUsageLog.timestamp))
    .limit(limit);
}


// ===== Webhook Management =====

export async function checkWebhookExists(eventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select().from(webhookEvents)
    .where(eq(webhookEvents.eventId, eventId))
    .limit(1);
  
  return result.length > 0;
}

export async function insertWebhookEvent(event: InsertWebhookEvent): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(webhookEvents).values(event);
    return result[0].insertId;
  } catch (error) {
    console.error('[Database] Error inserting webhook event:', error);
    return null;
  }
}

export async function markWebhookProcessed(eventId: string, error?: string) {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.update(webhookEvents)
      .set({
        processed: true,
        processedAt: new Date(),
        error: error || null,
      })
      .where(eq(webhookEvents.eventId, eventId));
  } catch (err) {
    console.error('[Database] Error marking webhook as processed:', err);
  }
}

export async function getRecentWebhooks(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(webhookEvents)
    .orderBy(desc(webhookEvents.receivedAt))
    .limit(limit);
}

export async function getWebhookStats(days: number = 7) {
  const db = await getDb();
  if (!db) return null;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const events = await db.select().from(webhookEvents)
    .where(gte(webhookEvents.receivedAt, startDate));
  
  const total = events.length;
  const processed = events.filter(e => e.processed).length;
  const failed = events.filter(e => e.error).length;
  
  // Agrupar por recurso
  const byResource: Record<string, number> = {};
  events.forEach(e => {
    byResource[e.resource] = (byResource[e.resource] || 0) + 1;
  });
  
  // Agrupar por ação
  const byAction: Record<string, number> = {};
  events.forEach(e => {
    byAction[e.action] = (byAction[e.action] || 0) + 1;
  });
  
  return {
    total,
    processed,
    failed,
    successRate: total > 0 ? ((processed - failed) / total * 100).toFixed(1) : '0',
    byResource,
    byAction,
  };
}


export async function getSalesByOrderId(orderId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(sales)
    .where(eq(sales.blingOrderId, orderId));
}

export async function deleteSale(saleId: number) {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.delete(sales).where(eq(sales.id, saleId));
  } catch (error) {
    console.error('[Database] Error deleting sale:', error);
  }
}


// ===== Product Supplier Management =====

export async function upsertProductSupplier(supplier: InsertProductSupplier) {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.insert(productSuppliers).values(supplier).onDuplicateKeyUpdate({
      set: {
        productId: supplier.productId,
        blingProductId: supplier.blingProductId,
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        description: supplier.description,
        code: supplier.code,
        costPrice: supplier.costPrice,
        purchasePrice: supplier.purchasePrice,
        isDefault: supplier.isDefault,
        warranty: supplier.warranty,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[Database] Error upserting product supplier:', error);
  }
}

export async function getProductSuppliersByProductId(productId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(productSuppliers)
    .where(eq(productSuppliers.productId, productId));
}

export async function deleteProductSupplier(blingId: string) {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.delete(productSuppliers).where(eq(productSuppliers.blingId, blingId));
  } catch (error) {
    console.error('[Database] Error deleting product supplier:', error);
  }
}

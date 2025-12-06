import { eq, desc, and, gte, lte, sql, isNull, or, like, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, products, inventory, sales, orders,
  inventoryCounts, alerts, countSchedule, blingConfig,
  syncHistory, syncConfig, apiUsageLog, webhookEvents,
  productSuppliers, validOrderStatuses, abcConfig,
  Product, Inventory, Sale, Order, InsertOrder, Alert, InventoryCount, CountSchedule, BlingConfig,
  InsertSyncHistory, InsertSyncConfig, SyncHistory, SyncConfig,
  ApiUsageLog, InsertApiUsageLog, WebhookEvent, InsertWebhookEvent,
  ProductSupplier, InsertProductSupplier, ValidOrderStatus, InsertValidOrderStatus
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
  
  // Filtrar produtos por código (ocultar 50000-51000 e < 2000)
  return await db.select().from(products).where(
    or(
      isNull(products.code),
      and(
        sql`CAST(${products.code} AS SIGNED) >= 2000`,
        or(
          sql`CAST(${products.code} AS SIGNED) < 50000`,
          sql`CAST(${products.code} AS SIGNED) > 51000`
        )
      )
    )
  );
}

export async function getProductsPaginated(params: {
  abcClass?: "A" | "B" | "C" | "D";
  search?: string;
  limit: number;
  offset: number;
}) {
  const db = await getDb();
  if (!db) return { products: [], total: 0 };
  
  const { abcClass, search, limit, offset } = params;
  
  // Construir condições
  const conditions = [];
  
  // Filtro de códigos (ocultar 50000-51000 e < 2000)
  conditions.push(
    or(
      isNull(products.code),
      and(
        sql`CAST(${products.code} AS SIGNED) >= 2000`,
        or(
          sql`CAST(${products.code} AS SIGNED) < 50000`,
          sql`CAST(${products.code} AS SIGNED) > 51000`
        )
      )
    )
  );
  
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
  const whereClause = conditions.length > 1 ? and(...conditions) : (conditions.length === 1 ? conditions[0] : undefined);
  
  // Buscar produtos paginados com estoque
  console.log('[DEBUG] Executando query getProductsPaginated...');
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
      abcRevenue: products.abcRevenue,
      abcPercentage: products.abcPercentage,
      abcLastCalculated: products.abcLastCalculated,
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
  
  console.log('[DEBUG] Primeiros 3 produtos:', JSON.stringify(productsList.slice(0, 3), null, 2));
  
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

export async function upsertSale(sale: Omit<Sale, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar se já existe venda com mesmo blingOrderId e productId
  const existing = await db.select()
    .from(sales)
    .where(
      and(
        eq(sales.blingOrderId, sale.blingOrderId),
        eq(sales.productId, sale.productId)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    // Atualizar
    await db.update(sales)
      .set({
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        totalPrice: sale.totalPrice,
        orderStatus: sale.orderStatus,
        saleDate: sale.saleDate,
      })
      .where(eq(sales.id, existing[0].id));
    return existing[0].id;
  } else {
    // Inserir
    const result = await db.insert(sales).values(sale as any);
    return result[0].insertId;
  }
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

export async function getLastSuccessfulSync(userId: number, syncType: 'products' | 'inventory' | 'sales' | 'suppliers' | 'full') {
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


// ===== Debug & Stats =====

export async function getDataStats() {
  const db = await getDb();
  if (!db) return null;

  const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(products);
  const [inventoryCount] = await db.select({ count: sql<number>`count(*)` }).from(inventory);
  const [salesCount] = await db.select({ count: sql<number>`count(*)` }).from(sales);
  const [suppliersCount] = await db.select({ count: sql<number>`count(*)` }).from(productSuppliers);
  
  const productsWithStockResult = await db.execute(sql`
    SELECT COUNT(DISTINCT productId) as count 
    FROM inventory 
    WHERE physicalStock > 0
  `);

  const sampleInventory = await db.select()
    .from(inventory)
    .limit(5);

  const productsWithStock = (productsWithStockResult[0] as unknown as any[])[0]?.count || 0;

  return {
    products: productCount.count,
    inventory: inventoryCount.count,
    sales: salesCount.count,
    suppliers: suppliersCount.count,
    productsWithStock,
    sampleInventory,
  };
}

// ===== Orders Management =====

export async function listOrders(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  userId?: number;
  filterByValidStatuses?: boolean;
}) {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };

  const { limit = 50, offset = 0, search, status, userId, filterByValidStatuses = false } = params || {};

  let conditions = [];
  
  if (search) {
    conditions.push(
      or(
        like(orders.orderNumber, `%${search}%`),
        like(orders.customerName, `%${search}%`),
        like(orders.customerDocument, `%${search}%`)
      )
    );
  }
  
  if (status) {
    conditions.push(eq(orders.status, status));
  }
  
  // Filtrar por situações válidas se solicitado
  if (filterByValidStatuses && userId) {
    const activeStatusIds = await getActiveStatusIds(userId);
    if (activeStatusIds.length > 0) {
      conditions.push(sql`${orders.statusId} IN (${sql.join(activeStatusIds.map(id => sql`${id}`), sql`, `)})`);
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [ordersList, countResult] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.orderDate))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause),
  ]);

  return {
    orders: ordersList,
    total: Number(countResult[0]?.count || 0),
  };
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getOrderByBlingId(blingId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(orders).where(eq(orders.blingId, blingId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertOrder(order: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getOrderByBlingId(order.blingId);

  if (existing) {
    await db
      .update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(orders).values(order);
    return result[0].insertId;
  }
}

export async function getOrdersStats() {
  const db = await getDb();
  if (!db) return { total: 0, totalAmount: 0 };

  const result = await db
    .select({
      total: sql<number>`count(*)`,
      totalAmount: sql<number>`sum(${orders.totalAmount})`,
    })
    .from(orders);

  return {
    total: Number(result[0]?.total || 0),
    totalAmount: Number(result[0]?.totalAmount || 0),
  };
}


// ===== Valid Order Statuses Management =====

/**
 * Lista todas as situações únicas encontradas nos pedidos importados
 */
export async function getUniqueOrderStatuses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Agrupar por statusId e pegar o status mais recente (não "Desconhecido")
  const result = await db
    .selectDistinct({
      statusId: orders.statusId,
      status: orders.status,
    })
    .from(orders)
    .where(sql`${orders.status} != 'Desconhecido'`)
    .orderBy(orders.statusId);
  
  // Remover duplicatas baseado apenas em statusId
  const uniqueMap = new Map<number, typeof result[0]>();
  result.forEach(item => {
    if (item.statusId !== null && !uniqueMap.has(item.statusId)) {
      uniqueMap.set(item.statusId, item);
    }
  });
  
  return Array.from(uniqueMap.values());
}

/**
 * Lista situações válidas configuradas pelo usuário
 */
export async function getValidOrderStatuses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(validOrderStatuses)
    .where(eq(validOrderStatuses.userId, userId))
    .orderBy(validOrderStatuses.statusId);
}

/**
 * Salva ou atualiza situações válidas
 */
export async function upsertValidOrderStatus(status: InsertValidOrderStatus) {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.insert(validOrderStatuses).values(status).onDuplicateKeyUpdate({
      set: {
        statusName: status.statusName,
        isActive: status.isActive,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[Database] Error upserting valid order status:', error);
  }
}

/**
 * Remove uma situação válida
 */
export async function deleteValidOrderStatus(id: number) {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.delete(validOrderStatuses).where(eq(validOrderStatuses.id, id));
  } catch (error) {
    console.error('[Database] Error deleting valid order status:', error);
  }
}

/**
 * Retorna IDs das situações ativas
 */
export async function getActiveStatusIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({ statusId: validOrderStatuses.statusId })
    .from(validOrderStatuses)
    .where(
      and(
        eq(validOrderStatuses.userId, userId),
        eq(validOrderStatuses.isActive, true)
      )
    );
  
  return result.map(r => r.statusId);
}


// ===== ABC Analysis =====

/**
 * Busca ou cria configuração de análise ABC
 */
export async function getAbcConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(abcConfig)
    .where(eq(abcConfig.userId, userId))
    .limit(1);
  
  if (result.length === 0) {
    // Criar configuração padrão
    await db.insert(abcConfig).values({
      userId,
      analysisMonths: 12,
      revenueWeight: 50,
      quantityWeight: 30,
      ordersWeight: 20,
      autoRecalculate: true,
    });
    
    return {
      userId,
      analysisMonths: 12,
      revenueWeight: 50,
      quantityWeight: 30,
      ordersWeight: 20,
      autoRecalculate: true,
      lastCalculation: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  
  return result[0];
}

/**
 * Atualiza configuração de análise ABC
 */
export async function updateAbcConfig(userId: number, config: { 
  analysisMonths?: number; 
  autoRecalculate?: boolean;
  revenueWeight?: number;
  quantityWeight?: number;
  ordersWeight?: number;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(abcConfig)
    .set({
      ...config,
      updatedAt: new Date(),
    })
    .where(eq(abcConfig.userId, userId));
}

/**
 * Calcula faturamento por produto no período especificado
 */
export async function calculateProductRevenue(userId: number, months: number) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  // Buscar IDs de situações válidas
  const validStatusIds = await getActiveStatusIds(userId);
  
  if (validStatusIds.length === 0) {
    console.warn('[ABC] Nenhuma situação válida configurada');
    return [];
  }
  
  // Calcular faturamento, quantidade e pedidos por produto (excluindo códigos 50000-51000 e < 2000)
  const result = await db
    .select({
      productId: sales.productId,
      totalRevenue: sql<number>`SUM(${sales.totalPrice})`.as('totalRevenue'),
      totalQuantity: sql<number>`SUM(${sales.quantity})`.as('totalQuantity'),
      totalOrders: sql<number>`COUNT(DISTINCT ${sales.blingOrderId})`.as('totalOrders'),
    })
    .from(sales)
    .innerJoin(orders, eq(sales.blingOrderId, orders.blingId))
    .innerJoin(products, eq(sales.productId, products.id))
    .where(
      and(
        gte(orders.orderDate, startDate),
        inArray(orders.statusId, validStatusIds),
        // Filtro de códigos (excluir 50000-51000 e < 2000)
        or(
          isNull(products.code),
          and(
            sql`CAST(${products.code} AS SIGNED) >= 2000`,
            or(
              sql`CAST(${products.code} AS SIGNED) < 50000`,
              sql`CAST(${products.code} AS SIGNED) > 51000`
            )
          )
        )
      )
    )
    .groupBy(sales.productId)
    .orderBy(desc(sql`SUM(${sales.totalPrice})`));
  
  return result.map(r => ({
    productId: r.productId,
    totalRevenue: Number(r.totalRevenue || 0),
    totalQuantity: Number(r.totalQuantity || 0),
    totalOrders: Number(r.totalOrders || 0),
  }));
}

/**
 * Classifica produtos em ABC+D usando múltiplos critérios ponderados:
 * - Faturamento (receita total)
 * - Quantidade vendida (volume)
 * - Número de pedidos (frequência/popularidade)
 * 
 * A = Top 20% do score ponderado (80% do valor total)
 * B = Próximos 30% (15% do valor)
 * C = Próximos 30% (4% do valor)
 * D = Últimos 20% ou sem vendas (1% do valor)
 */
export async function calculateAbcClassification(userId: number) {
  const db = await getDb();
  if (!db) return { success: false, message: 'Database not available' };
  
  try {
    // Buscar configuração
    const config = await getAbcConfig(userId);
    if (!config) {
      return { success: false, message: 'Configuração ABC não encontrada' };
    }
    
    // Calcular métricas por produto
    const productMetrics = await calculateProductRevenue(userId, config.analysisMonths);
    
    if (productMetrics.length === 0) {
      return { success: false, message: 'Nenhuma venda encontrada no período' };
    }
    
    // Encontrar valores máximos para normalização (0-1)
    const maxRevenue = Math.max(...productMetrics.map(p => p.totalRevenue));
    const maxQuantity = Math.max(...productMetrics.map(p => p.totalQuantity));
    const maxOrders = Math.max(...productMetrics.map(p => p.totalOrders));
    
    // Calcular score ponderado para cada produto
    const productsWithScore = productMetrics.map(product => {
      // Normalizar métricas (0-1)
      const normalizedRevenue = maxRevenue > 0 ? product.totalRevenue / maxRevenue : 0;
      const normalizedQuantity = maxQuantity > 0 ? product.totalQuantity / maxQuantity : 0;
      const normalizedOrders = maxOrders > 0 ? product.totalOrders / maxOrders : 0;
      
      // Aplicar pesos (convertendo de 0-100 para 0-1)
      const revenueWeight = config.revenueWeight / 100;
      const quantityWeight = config.quantityWeight / 100;
      const ordersWeight = config.ordersWeight / 100;
      
      // Calcular score final ponderado
      const score = (
        normalizedRevenue * revenueWeight +
        normalizedQuantity * quantityWeight +
        normalizedOrders * ordersWeight
      );
      
      return {
        productId: product.productId,
        totalRevenue: product.totalRevenue,
        totalQuantity: product.totalQuantity,
        totalOrders: product.totalOrders,
        score,
      };
    });
    
    // Ordenar por score (maior para menor)
    productsWithScore.sort((a, b) => b.score - a.score);
    
    // Calcular totais para percentuais
    const totalRevenue = productsWithScore.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalScore = productsWithScore.reduce((sum, p) => sum + p.score, 0);
    
    // Classificar usando curva ABC (80-15-4-1)
    let accumulatedScore = 0;
    const classifications: Array<{
      productId: number;
      abcClass: 'A' | 'B' | 'C' | 'D';
      abcRevenue: number;
      abcPercentage: number;
    }> = [];
    
    for (const product of productsWithScore) {
      accumulatedScore += product.score;
      const accumulatedPercentage = (accumulatedScore / totalScore) * 100;
      const productPercentage = (product.totalRevenue / totalRevenue) * 100;
      
      let abcClass: 'A' | 'B' | 'C' | 'D';
      if (accumulatedPercentage <= 80) {
        abcClass = 'A';
      } else if (accumulatedPercentage <= 95) {
        abcClass = 'B';
      } else {
        abcClass = 'C';
      }
      
      classifications.push({
        productId: product.productId,
        abcClass,
        abcRevenue: product.totalRevenue,
        abcPercentage: Math.round(productPercentage * 100), // 0-10000 (0-100.00%)
      });
    }
    
    // Buscar todos os produtos (excluindo códigos 50000-51000 e < 2000)
    const allProducts = await db.select({ id: products.id })
      .from(products)
      .where(
        or(
          isNull(products.code),
          and(
            sql`CAST(${products.code} AS SIGNED) >= 2000`,
            or(
              sql`CAST(${products.code} AS SIGNED) < 50000`,
              sql`CAST(${products.code} AS SIGNED) > 51000`
            )
          )
        )
      );
    const productsWithSales = new Set(classifications.map(c => c.productId));
    
    // Produtos sem vendas = classe D
    for (const product of allProducts) {
      if (!productsWithSales.has(product.id)) {
        classifications.push({
          productId: product.id,
          abcClass: 'D',
          abcRevenue: 0,
          abcPercentage: 0,
        });
      }
    }
    
    // Atualizar produtos no banco
    const now = new Date();
    for (const classification of classifications) {
      await db
        .update(products)
        .set({
          abcClass: classification.abcClass,
          abcRevenue: classification.abcRevenue,
          abcPercentage: classification.abcPercentage,
          abcLastCalculated: now,
          updatedAt: now,
        })
        .where(eq(products.id, classification.productId));
    }
    
    // Atualizar data da última calculação
    await db
      .update(abcConfig)
      .set({
        lastCalculation: now,
        updatedAt: now,
      })
      .where(eq(abcConfig.userId, userId));
    
    return {
      success: true,
      message: 'Análise ABC+D calculada com sucesso',
      stats: {
        totalProducts: allProducts.length,
        classA: classifications.filter(c => c.abcClass === 'A').length,
        classB: classifications.filter(c => c.abcClass === 'B').length,
        classC: classifications.filter(c => c.abcClass === 'C').length,
        classD: classifications.filter(c => c.abcClass === 'D').length,
        totalRevenue,
        analysisMonths: config.analysisMonths,
      },
    };
  } catch (error) {
    console.error('[ABC] Erro ao calcular classificação:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Obtém métricas de estoque por classe ABC+D
 * Calcula valor em estoque (quantidade × preço) e quantidade total em estoque
 */
export async function getAbcStockMetrics() {
  const db = await getDb();
  if (!db) {
    return {
      classA: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      classB: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      classC: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      classD: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      total: { stockValue: 0, stockQuantity: 0, productCount: 0 },
    };
  }

  try {
    // Buscar todos os produtos com seus estoques
    const productsWithStock = await db
      .select({
        productId: products.id,
        abcClass: products.abcClass,
        price: products.price,
        physicalStock: inventory.physicalStock,
      })
      .from(products)
      .leftJoin(inventory, eq(products.id, inventory.productId));

    // Agrupar estoque por produto (somar todos os depósitos)
    const stockByProduct = new Map<number, { abcClass: string | null, price: number, totalStock: number }>();
    
    for (const row of productsWithStock) {
      const existing = stockByProduct.get(row.productId);
      const stock = row.physicalStock || 0;
      
      if (existing) {
        existing.totalStock += stock;
      } else {
        stockByProduct.set(row.productId, {
          abcClass: row.abcClass,
          price: row.price,
          totalStock: stock,
        });
      }
    }

    // Calcular métricas por classe
    const metrics = {
      classA: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      classB: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      classC: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      classD: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      total: { stockValue: 0, stockQuantity: 0, productCount: 0 },
    };

    stockByProduct.forEach((data) => {
      // Ignorar produtos sem estoque
      if (data.totalStock <= 0) {
        return;
      }
      
      // price em centavos, totalStock é quantidade
      // Dividir por 100 para converter centavos em reais
      const stockValue = (data.totalStock * data.price) / 100;
      const stockQuantity = data.totalStock;
      
      // Classificar produto
      let className: 'classA' | 'classB' | 'classC' | 'classD';
      if (data.abcClass === 'A') {
        className = 'classA';
      } else if (data.abcClass === 'B') {
        className = 'classB';
      } else if (data.abcClass === 'C') {
        className = 'classC';
      } else {
        // Produtos sem classificação ou classe D
        className = 'classD';
      }
      
      metrics[className].stockValue += stockValue;
      metrics[className].stockQuantity += stockQuantity;
      metrics[className].productCount += 1;
      
      metrics.total.stockValue += stockValue;
      metrics.total.stockQuantity += stockQuantity;
      metrics.total.productCount += 1;
    });

    return metrics;
  } catch (error) {
    console.error('[ABC] Erro ao obter métricas de estoque:', error);
    return {
      classA: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      classB: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      classC: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      classD: { stockValue: 0, stockQuantity: 0, productCount: 0 },
      total: { stockValue: 0, stockQuantity: 0, productCount: 0 },
    };
  }
}

/**
 * Obtém contagens de produtos por classe ABC+D
 * Retorna TODOS os produtos classificados (não filtra por estoque)
 */
export async function getAbcCounts() {
  const db = await getDb();
  if (!db) {
    return {
      classA: 0,
      classB: 0,
      classC: 0,
      classD: 0,
      total: 0,
    };
  }

  try {
    // Contar produtos por classe (aplicando filtros de código)
    const counts = await db
      .select({
        abcClass: products.abcClass,
        count: sql<number>`COUNT(*)`,
      })
      .from(products)
      .where(
        or(
          isNull(products.code),
          and(
            sql`CAST(${products.code} AS SIGNED) >= 2000`,
            or(
              sql`CAST(${products.code} AS SIGNED) < 50000`,
              sql`CAST(${products.code} AS SIGNED) > 51000`
            )
          )
        )
      )
      .groupBy(products.abcClass);

    // Organizar contagens por classe
    const result = {
      classA: 0,
      classB: 0,
      classC: 0,
      classD: 0,
      total: 0,
    };

    counts.forEach((row) => {
      const count = Number(row.count);
      result.total += count;

      if (row.abcClass === 'A') {
        result.classA = count;
      } else if (row.abcClass === 'B') {
        result.classB = count;
      } else if (row.abcClass === 'C') {
        result.classC = count;
      } else if (row.abcClass === 'D') {
        result.classD = count;
      }
    });

    return result;
  } catch (error) {
    console.error('[ABC] Erro ao obter contagens:', error);
    return {
      classA: 0,
      classB: 0,
      classC: 0,
      classD: 0,
      total: 0,
    };
  }
}

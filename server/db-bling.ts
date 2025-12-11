import { eq, and, desc, sql, gte, lte, isNull, or } from "drizzle-orm";
import { getDb } from "./db";
import {
  blingConfig,
  products,
  orders,
  sales,
  inventory,
  productSuppliers,
  syncConfig,
  syncHistory,
  webhookEvents,
  abcConfig,
  abcHistory,
  abcCalculationLog,
  abcAutoCalculationConfig,
  alerts,
  apiUsageLog,
  countSchedule,
  inventoryCounts,
  validOrderStatuses,
  type InsertBlingConfig,
  type InsertProduct,
  type InsertOrder,
  type InsertSale,
  type InsertInventory,
  type InsertProductSupplier,
  type InsertSyncConfig,
  type InsertSyncHistory,
  type InsertWebhookEvent,
  type InsertAbcConfig,
  type InsertAbcHistory,
  type InsertAbcCalculationLog,
  type InsertAbcAutoCalculationConfig,
  type InsertAlert,
  type InsertApiUsageLog,
  type InsertCountSchedule,
  type InsertInventoryCount,
  type InsertValidOrderStatus,
} from "../drizzle/schema";

// ============================================================================
// BLING CONFIG
// ============================================================================

export async function getBlingConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(blingConfig).where(eq(blingConfig.userId, userId)).limit(1);
  return result[0];
}

export async function upsertBlingConfig(config: InsertBlingConfig) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(blingConfig).values(config).onConflictDoUpdate({
    target: blingConfig.userId,
    set: {
      ...config,
      updatedAt: new Date(),
    },
  });
}

export async function updateBlingTokens(userId: number, tokens: { accessToken: string; refreshToken: string; tokenExpiresAt: Date }) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(blingConfig)
    .set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.tokenExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(blingConfig.userId, userId));
}

// ============================================================================
// PRODUCTS
// ============================================================================

export async function upsertProduct(product: InsertProduct) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(products).values(product).onConflictDoUpdate({
    target: products.blingId,
    set: {
      ...product,
      updatedAt: new Date(),
    },
  });
}

export async function getProductByBlingId(blingId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.blingId, blingId)).limit(1);
  return result[0];
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getAllProducts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(products).where(eq(products.userId, userId));
}

export async function getProductsPaginated(userId: number, page: number, limit: number, search?: string) {
  const db = await getDb();
  if (!db) return { products: [], total: 0 };
  
  const offset = (page - 1) * limit;
  let query = db.select().from(products).where(eq(products.userId, userId));
  
  if (search) {
    query = query.where(
      or(
        sql`${products.name} ILIKE ${`%${search}%`}`,
        sql`${products.code} ILIKE ${`%${search}%`}`
      ) as any
    );
  }
  
  const [productsResult, totalResult] = await Promise.all([
    query.limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.userId, userId)),
  ]);
  
  return {
    products: productsResult,
    total: Number(totalResult[0]?.count || 0),
  };
}

export async function getProductsByAbcClass(userId: number, abcClass: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(products).where(
    and(
      eq(products.userId, userId),
      eq(products.abcClass, abcClass as any)
    )
  );
}

export async function updateProductMaxStock(productId: number, maxStock: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set({ maxStock, updatedAt: new Date() }).where(eq(products.id, productId));
}

export async function getProductsForReplenishment(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(products).where(
    and(
      eq(products.userId, userId),
      sql`${products.currentStock} <= ${products.reorderPoint}`
    )
  );
}

// ============================================================================
// ORDERS
// ============================================================================

export async function upsertOrder(order: InsertOrder) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(orders).values(order).onConflictDoUpdate({
    target: orders.blingId,
    set: {
      ...order,
      updatedAt: new Date(),
    },
  });
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function deleteOrderByBlingId(blingId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(orders).where(eq(orders.blingId, blingId));
}

export async function listOrders(userId: number, page: number, limit: number) {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };
  
  const offset = (page - 1) * limit;
  const [ordersResult, totalResult] = await Promise.all([
    db.select().from(orders).where(eq(orders.userId, userId)).limit(limit).offset(offset).orderBy(desc(orders.createdAt)),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.userId, userId)),
  ]);
  
  return {
    orders: ordersResult,
    total: Number(totalResult[0]?.count || 0),
  };
}

export async function getOrdersStats(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, totalValue: 0 };
  
  const result = await db.select({
    total: sql<number>`count(*)`,
    totalValue: sql<number>`sum(${orders.totalValue})`,
  }).from(orders).where(eq(orders.userId, userId));
  
  return {
    total: Number(result[0]?.total || 0),
    totalValue: Number(result[0]?.totalValue || 0),
  };
}

// ============================================================================
// SALES
// ============================================================================

export async function upsertSale(sale: InsertSale) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(sales).values(sale).onConflictDoUpdate({
    target: [sales.orderId, sales.productId],
    set: {
      ...sale,
      updatedAt: new Date(),
    },
  });
}

export async function getSalesByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(sales).where(eq(sales.orderId, orderId));
}

export async function getSalesByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(sales).where(eq(sales.productId, productId));
}

export async function deleteSale(orderId: number, productId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(sales).where(
    and(
      eq(sales.orderId, orderId),
      eq(sales.productId, productId)
    )
  );
}

export async function getSalesForProduct(productId: number, months: number) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  return await db.select().from(sales).where(
    and(
      eq(sales.productId, productId),
      gte(sales.saleDate, startDate)
    )
  ).orderBy(desc(sales.saleDate));
}

export async function getMonthlySalesByProduct(productId: number, months: number) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  const result = await db.select({
    month: sql<string>`to_char(${sales.saleDate}, 'YYYY-MM')`,
    totalQuantity: sql<number>`sum(${sales.quantity})`,
    totalRevenue: sql<number>`sum(${sales.totalValue})`,
  }).from(sales).where(
    and(
      eq(sales.productId, productId),
      gte(sales.saleDate, startDate)
    )
  ).groupBy(sql`to_char(${sales.saleDate}, 'YYYY-MM')`).orderBy(sql`to_char(${sales.saleDate}, 'YYYY-MM')`);
  
  return result;
}

// ============================================================================
// INVENTORY
// ============================================================================

export async function upsertInventory(inv: InsertInventory) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(inventory).values(inv).onConflictDoUpdate({
    target: [inventory.productId, inventory.warehouseId],
    set: {
      ...inv,
      updatedAt: new Date(),
    },
  });
}

export async function getInventoryByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inventory).where(eq(inventory.productId, productId));
}

export async function getTotalInventoryByProduct(productId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({
    total: sql<number>`sum(${inventory.quantity})`,
  }).from(inventory).where(eq(inventory.productId, productId));
  
  return Number(result[0]?.total || 0);
}

// ============================================================================
// PRODUCT SUPPLIERS
// ============================================================================

export async function upsertProductSupplier(supplier: InsertProductSupplier) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(productSuppliers).values(supplier).onConflictDoUpdate({
    target: [productSuppliers.productId, productSuppliers.supplierId],
    set: {
      ...supplier,
      updatedAt: new Date(),
    },
  });
}

export async function deleteProductSupplier(productId: number, supplierId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(productSuppliers).where(
    and(
      eq(productSuppliers.productId, productId),
      eq(productSuppliers.supplierId, supplierId)
    )
  );
}

export async function getUniqueSuppliers(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.selectDistinct({
    supplierId: productSuppliers.supplierId,
    supplierName: productSuppliers.supplierName,
  }).from(productSuppliers)
    .innerJoin(products, eq(productSuppliers.productId, products.id))
    .where(eq(products.userId, userId));
  
  return result;
}

export async function updateSupplierLeadTime(productId: number, supplierId: number, leadTime: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(productSuppliers).set({ leadTime, updatedAt: new Date() }).where(
    and(
      eq(productSuppliers.productId, productId),
      eq(productSuppliers.supplierId, supplierId)
    )
  );
}

// ============================================================================
// SYNC CONFIG & HISTORY
// ============================================================================

export async function getSyncConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(syncConfig).where(eq(syncConfig.userId, userId)).limit(1);
  return result[0];
}

export async function upsertSyncConfig(config: InsertSyncConfig) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(syncConfig).values(config).onConflictDoUpdate({
    target: syncConfig.userId,
    set: {
      ...config,
      updatedAt: new Date(),
    },
  });
}

export async function createSyncHistory(history: InsertSyncHistory) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(syncHistory).values(history).returning();
  return result[0];
}

export async function updateSyncHistory(id: number, updates: Partial<InsertSyncHistory>) {
  const db = await getDb();
  if (!db) return;
  await db.update(syncHistory).set(updates).where(eq(syncHistory.id, id));
}

export async function getLastSuccessfulSync(userId: number, syncType: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(syncHistory)
    .where(and(
      eq(syncHistory.userId, userId),
      eq(syncHistory.syncType, syncType as any),
      eq(syncHistory.status, 'completed')
    ))
    .orderBy(desc(syncHistory.endedAt))
    .limit(1);
  return result[0];
}

export async function getRecentSyncHistory(userId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(syncHistory)
    .where(eq(syncHistory.userId, userId))
    .orderBy(desc(syncHistory.startedAt))
    .limit(limit);
}

// ============================================================================
// WEBHOOKS
// ============================================================================

export async function insertWebhookEvent(event: InsertWebhookEvent) {
  const db = await getDb();
  if (!db) return;
  await db.insert(webhookEvents).values(event);
}

export async function checkWebhookExists(eventId: string) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)).limit(1);
  return result.length > 0;
}

export async function markWebhookProcessed(eventId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(webhookEvents).set({ processed: true, processedAt: new Date() }).where(eq(webhookEvents.eventId, eventId));
}

export async function getRecentWebhooks(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(webhookEvents)
    .where(eq(webhookEvents.userId, userId))
    .orderBy(desc(webhookEvents.receivedAt))
    .limit(limit);
}

export async function getWebhookStats(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, processed: 0, failed: 0 };
  
  const result = await db.select({
    total: sql<number>`count(*)`,
    processed: sql<number>`count(*) filter (where ${webhookEvents.processed} = true)`,
    failed: sql<number>`count(*) filter (where ${webhookEvents.error} is not null)`,
  }).from(webhookEvents).where(eq(webhookEvents.userId, userId));
  
  return {
    total: Number(result[0]?.total || 0),
    processed: Number(result[0]?.processed || 0),
    failed: Number(result[0]?.failed || 0),
  };
}

// ============================================================================
// ABC CLASSIFICATION
// ============================================================================

export async function getAbcConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(abcConfig).where(eq(abcConfig.userId, userId)).limit(1);
  return result[0];
}

export async function updateAbcConfig(userId: number, config: Partial<InsertAbcConfig>) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(abcConfig).values({ userId, ...config } as InsertAbcConfig).onConflictDoUpdate({
    target: abcConfig.userId,
    set: {
      ...config,
      updatedAt: new Date(),
    },
  });
}

export async function getAbcAutoCalculationConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(abcAutoCalculationConfig).where(eq(abcAutoCalculationConfig.userId, userId)).limit(1);
  return result[0];
}

export async function updateAbcAutoCalculationConfig(userId: number, config: Partial<InsertAbcAutoCalculationConfig>) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(abcAutoCalculationConfig).values({ userId, ...config } as InsertAbcAutoCalculationConfig).onConflictDoUpdate({
    target: abcAutoCalculationConfig.userId,
    set: {
      ...config,
      updatedAt: new Date(),
    },
  });
}

export async function upsertAbcAutoCalculationConfig(config: InsertAbcAutoCalculationConfig) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(abcAutoCalculationConfig).values(config).onConflictDoUpdate({
    target: abcAutoCalculationConfig.userId,
    set: {
      ...config,
      updatedAt: new Date(),
    },
  });
}

export async function calculateAbcClassification(userId: number) {
  // Placeholder - implementar lógica ABC real
  return { success: true };
}

export async function generateAbcAnalysisWithAI(userId: number) {
  // Placeholder - implementar análise ABC com IA
  return { analysis: "Análise ABC pendente de implementação" };
}

export async function getAbcCounts(userId: number) {
  const db = await getDb();
  if (!db) return { A: 0, B: 0, C: 0, D: 0 };
  
  const result = await db.select({
    abcClass: products.abcClass,
    count: sql<number>`count(*)`,
  }).from(products).where(eq(products.userId, userId)).groupBy(products.abcClass);
  
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  result.forEach(r => {
    if (r.abcClass) counts[r.abcClass as keyof typeof counts] = Number(r.count);
  });
  
  return counts;
}

export async function getAbcStockMetrics(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    abcClass: products.abcClass,
    totalStock: sql<number>`sum(${products.currentStock})`,
    totalValue: sql<number>`sum(${products.currentStock} * ${products.cost})`,
  }).from(products).where(eq(products.userId, userId)).groupBy(products.abcClass);
  
  return result;
}

export async function getClassChanges(userId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(abcHistory)
    .where(eq(abcHistory.userId, userId))
    .orderBy(desc(abcHistory.changedAt))
    .limit(limit);
}

export async function getEvolutionStats(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    month: sql<string>`to_char(${abcHistory.changedAt}, 'YYYY-MM')`,
    classA: sql<number>`count(*) filter (where ${abcHistory.newClass} = 'A')`,
    classB: sql<number>`count(*) filter (where ${abcHistory.newClass} = 'B')`,
    classC: sql<number>`count(*) filter (where ${abcHistory.newClass} = 'C')`,
  }).from(abcHistory).where(eq(abcHistory.userId, userId))
    .groupBy(sql`to_char(${abcHistory.changedAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${abcHistory.changedAt}, 'YYYY-MM')`);
  
  return result;
}

// ============================================================================
// ALERTS
// ============================================================================

export async function insertAlert(alert: InsertAlert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(alerts).values(alert);
}

export async function getActiveAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(alerts)
    .where(and(
      eq(alerts.userId, userId),
      eq(alerts.resolved, false)
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

export async function markAlertResolved(alertId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(alerts).set({ resolved: true, resolvedAt: new Date() }).where(eq(alerts.id, alertId));
}

// ============================================================================
// API USAGE LOG
// ============================================================================

export async function logApiUsage(data: InsertApiUsageLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(apiUsageLog).values(data);
}

export async function getApiUsageStats(userId: number, days: number = 7) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const result = await db.select({
    date: sql<string>`date(${apiUsageLog.timestamp})`,
    totalRequests: sql<number>`count(*)`,
    successRequests: sql<number>`count(*) filter (where ${apiUsageLog.status} between 200 and 299)`,
    errorRequests: sql<number>`count(*) filter (where ${apiUsageLog.status} >= 400)`,
    avgResponseTime: sql<number>`avg(${apiUsageLog.responseTime})`,
  }).from(apiUsageLog)
    .where(and(
      eq(apiUsageLog.userId, userId),
      gte(apiUsageLog.timestamp, startDate)
    ))
    .groupBy(sql`date(${apiUsageLog.timestamp})`)
    .orderBy(sql`date(${apiUsageLog.timestamp})`);
  
  return result;
}

export async function getApiUsageToday(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db.select({
    count: sql<number>`count(*)`,
  }).from(apiUsageLog).where(
    and(
      eq(apiUsageLog.userId, userId),
      gte(apiUsageLog.timestamp, today)
    )
  );
  
  return Number(result[0]?.count || 0);
}

export async function getRecentRateLimitErrors(userId: number, hours: number = 24) {
  const db = await getDb();
  if (!db) return [];
  
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);
  
  return await db.select().from(apiUsageLog)
    .where(and(
      eq(apiUsageLog.userId, userId),
      eq(apiUsageLog.status, 429),
      gte(apiUsageLog.timestamp, startTime)
    ))
    .orderBy(desc(apiUsageLog.timestamp));
}

export async function isRateLimitError(status: number) {
  return status === 429;
}

export async function getDataStats(userId: number) {
  const db = await getDb();
  if (!db) return { products: 0, orders: 0, sales: 0 };
  
  const [productsCount, ordersCount, salesCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(sales)
      .innerJoin(products, eq(sales.productId, products.id))
      .where(eq(products.userId, userId)),
  ]);
  
  return {
    products: Number(productsCount[0]?.count || 0),
    orders: Number(ordersCount[0]?.count || 0),
    sales: Number(salesCount[0]?.count || 0),
  };
}

// ============================================================================
// COUNT SCHEDULE & INVENTORY COUNTS
// ============================================================================

export async function getDueCountSchedules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const today = new Date();
  return await db.select().from(countSchedule)
    .where(and(
      eq(countSchedule.userId, userId),
      lte(countSchedule.nextCountDate, today)
    ))
    .orderBy(countSchedule.nextCountDate);
}

export async function insertInventoryCount(count: InsertInventoryCount) {
  const db = await getDb();
  if (!db) return;
  await db.insert(inventoryCounts).values(count);
}

export async function getInventoryCountsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inventoryCounts)
    .where(eq(inventoryCounts.productId, productId))
    .orderBy(desc(inventoryCounts.countDate));
}

// ============================================================================
// VALID ORDER STATUSES
// ============================================================================

export async function getValidOrderStatuses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(validOrderStatuses).where(eq(validOrderStatuses.userId, userId));
}

export async function upsertValidOrderStatus(status: InsertValidOrderStatus) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(validOrderStatuses).values(status).onConflictDoUpdate({
    target: [validOrderStatuses.userId, validOrderStatuses.blingStatusId],
    set: {
      ...status,
      updatedAt: new Date(),
    },
  });
}

export async function deleteValidOrderStatus(userId: number, blingStatusId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(validOrderStatuses).where(
    and(
      eq(validOrderStatuses.userId, userId),
      eq(validOrderStatuses.blingStatusId, blingStatusId)
    )
  );
}

export async function getUniqueOrderStatuses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.selectDistinct({
    status: orders.status,
  }).from(orders).where(eq(orders.userId, userId));
  
  return result.map(r => r.status).filter(Boolean);
}

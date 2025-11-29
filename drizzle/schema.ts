import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Configurações de integração com Bling
 */
export const blingConfig = mysqlTable("bling_config", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: varchar("clientId", { length: 255 }),
  clientSecret: varchar("clientSecret", { length: 255 }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  isActive: boolean("isActive").default(false).notNull(),
  lastSync: timestamp("lastSync"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BlingConfig = typeof blingConfig.$inferSelect;
export type InsertBlingConfig = typeof blingConfig.$inferInsert;

/**
 * Produtos sincronizados do Bling
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  blingId: varchar("blingId", { length: 64 }).notNull().unique(),
  code: varchar("code", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: int("price").notNull().default(0), // em centavos
  cost: int("cost").notNull().default(0), // em centavos
  unit: varchar("unit", { length: 20 }),
  
  // Classificação ABC
  abcClass: mysqlEnum("abcClass", ["A", "B", "C"]),
  abcClassManual: boolean("abcClassManual").default(false).notNull(),
  
  // Parâmetros de estoque
  shouldStock: boolean("shouldStock").default(true).notNull(),
  minStock: int("minStock").default(0).notNull(),
  maxStock: int("maxStock").default(0).notNull(),
  reorderPoint: int("reorderPoint").default(0).notNull(),
  safetyStock: int("safetyStock").default(0).notNull(),
  
  // Métricas calculadas
  avgSales12Months: int("avgSales12Months").default(0).notNull(),
  suggestedOrderQty: int("suggestedOrderQty").default(0).notNull(),
  lastSaleDate: timestamp("lastSaleDate"),
  
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Estoque atual dos produtos
 */
export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  depositId: varchar("depositId", { length: 64 }),
  depositName: varchar("depositName", { length: 255 }),
  
  virtualStock: int("virtualStock").notNull().default(0),
  physicalStock: int("physicalStock").notNull().default(0),
  reservedStock: int("reservedStock").notNull().default(0),
  
  lastPhysicalCount: timestamp("lastPhysicalCount"),
  lastVirtualSync: timestamp("lastVirtualSync"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

/**
 * Histórico de vendas
 */
export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  blingOrderId: varchar("blingOrderId", { length: 64 }).notNull(),
  productId: int("productId").notNull(),
  
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(), // em centavos
  totalPrice: int("totalPrice").notNull(), // em centavos
  
  orderStatus: varchar("orderStatus", { length: 50 }), // Status do pedido (atendido, faturado, etc)
  saleDate: timestamp("saleDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

/**
 * Histórico de contagens de inventário
 */
export const inventoryCounts = mysqlTable("inventory_counts", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  userId: int("userId").notNull(),
  
  expectedQty: int("expectedQty").notNull(),
  countedQty: int("countedQty").notNull(),
  variance: int("variance").notNull(),
  
  countType: mysqlEnum("countType", ["scheduled", "alert", "manual"]).notNull(),
  notes: text("notes"),
  
  countDate: timestamp("countDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryCount = typeof inventoryCounts.$inferSelect;
export type InsertInventoryCount = typeof inventoryCounts.$inferInsert;

/**
 * Alertas do sistema
 */
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  
  alertType: mysqlEnum("alertType", [
    "low_stock",
    "reorder_needed",
    "excess_stock",
    "inventory_variance",
    "negative_stock",
    "recount_needed"
  ]).notNull(),
  
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
  message: text("message").notNull(),
  
  isRead: boolean("isRead").default(false).notNull(),
  isResolved: boolean("isResolved").default(false).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: int("resolvedBy"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Agenda de contagens cíclicas
 */
export const countSchedule = mysqlTable("count_schedule", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  
  frequency: mysqlEnum("frequency", ["weekly", "biweekly", "monthly", "quarterly", "biannual", "annual"]).notNull(),
  nextCountDate: timestamp("nextCountDate").notNull(),
  lastCountDate: timestamp("lastCountDate"),
  
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CountSchedule = typeof countSchedule.$inferSelect;
export type InsertCountSchedule = typeof countSchedule.$inferInsert;

/**
 * Histórico de sincronizações
 */
export const syncHistory = mysqlTable("sync_history", {
  id: int("id").autoincrement().primaryKey(),
  syncType: mysqlEnum("sync_type", ["products", "inventory", "sales", "full"]).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed", "queued", "retrying"]).notNull(),
  itemsSynced: int("items_synced").default(0).notNull(),
  itemsErrors: int("items_errors").default(0).notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  triggeredBy: mysqlEnum("triggered_by", ["manual", "scheduled", "webhook"]).notNull(),
  retryCount: int("retry_count").default(0).notNull(),
  maxRetries: int("max_retries").default(3).notNull(),
  nextRetryAt: timestamp("next_retry_at"),
});

export type SyncHistory = typeof syncHistory.$inferSelect;
export type InsertSyncHistory = typeof syncHistory.$inferInsert;

/**
 * Configurações de sincronização automática
 */
export const syncConfig = mysqlTable("sync_config", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  autoSyncEnabled: boolean("auto_sync_enabled").default(false).notNull(),
  syncFrequencyHours: int("sync_frequency_hours").default(24).notNull(), // A cada quantas horas sincronizar
  lastAutoSync: timestamp("last_auto_sync"),
  nextAutoSync: timestamp("next_auto_sync"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SyncConfig = typeof syncConfig.$inferSelect;
export type InsertSyncConfig = typeof syncConfig.$inferInsert;

/**
 * Rastreamento de uso da API do Bling
 */
export const apiUsageLog = mysqlTable("api_usage_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  method: varchar("method", { length: 10 }).notNull().default("GET"),
  statusCode: int("status_code").notNull(),
  responseTime: int("response_time"), // em milissegundos
  isRateLimitError: boolean("is_rate_limit_error").default(false).notNull(),
  retryAttempt: int("retry_attempt").default(0).notNull(),
  circuitBreakerActive: boolean("circuit_breaker_active").default(false).notNull(),
  syncHistoryId: int("sync_history_id"), // Relacionar com sincronização
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type ApiUsageLog = typeof apiUsageLog.$inferSelect;
export type InsertApiUsageLog = typeof apiUsageLog.$inferInsert;


/**
 * Registro de webhooks recebidos do Bling
 * Usado para idempotência e auditoria
 */
export const webhookEvents = mysqlTable("webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("event_id", { length: 64 }).notNull().unique(), // ID único do evento do Bling
  resource: varchar("resource", { length: 50 }).notNull(), // product, stock, order, etc
  action: varchar("action", { length: 20 }).notNull(), // created, updated, deleted
  companyId: varchar("company_id", { length: 64 }), // ID da empresa no Bling
  version: varchar("version", { length: 10 }).default("v1").notNull(),
  payload: text("payload").notNull(), // JSON completo do webhook
  processed: boolean("processed").default(false).notNull(),
  processedAt: timestamp("processed_at"),
  error: text("error"), // Mensagem de erro se houver
  receivedAt: timestamp("received_at").defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: { name: "idx_event_id", columns: [table.eventId] },
  resourceActionIdx: { name: "idx_resource_action", columns: [table.resource, table.action] },
  receivedAtIdx: { name: "idx_received_at", columns: [table.receivedAt] },
}));

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;


/**
 * Produto Fornecedor - Vinculação de produtos com fornecedores
 */
export const productSuppliers = mysqlTable("product_suppliers", {
  id: int("id").autoincrement().primaryKey(),
  blingId: varchar("blingId", { length: 64 }).notNull().unique(),
  
  productId: int("productId").notNull(), // Referência ao produto local
  blingProductId: varchar("blingProductId", { length: 64 }).notNull(), // ID do produto no Bling
  
  supplierId: varchar("supplierId", { length: 64 }).notNull(), // ID do fornecedor no Bling
  supplierName: varchar("supplierName", { length: 255 }),
  
  description: text("description"),
  code: varchar("code", { length: 100 }), // Código do produto no fornecedor
  
  costPrice: int("costPrice").default(0).notNull(), // Preço de custo em centavos
  purchasePrice: int("purchasePrice").default(0).notNull(), // Preço de compra em centavos
  
  isDefault: boolean("isDefault").default(false).notNull(), // Fornecedor padrão
  warranty: int("warranty").default(0), // Garantia em meses
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductSupplier = typeof productSuppliers.$inferSelect;
export type InsertProductSupplier = typeof productSuppliers.$inferInsert;

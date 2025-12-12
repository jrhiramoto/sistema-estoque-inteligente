import { pgTable, serial, varchar, text, timestamp, boolean, integer, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Enums para Postgres
 */
export const roleEnum = pgEnum("role", ["user", "admin", "master"]);
export const abcClassEnum = pgEnum("abc_class", ["A", "B", "C", "D"]);
export const countTypeEnum = pgEnum("count_type", ["scheduled", "alert", "manual"]);
export const alertTypeEnum = pgEnum("alert_type", [
  "low_stock",
  "reorder_needed",
  "excess_stock",
  "inventory_variance",
  "negative_stock",
  "recount_needed"
]);
export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);
export const frequencyEnum = pgEnum("frequency", ["weekly", "biweekly", "monthly", "quarterly", "biannual", "annual"]);
export const syncTypeEnum = pgEnum("sync_type", ["products", "inventory", "sales", "suppliers", "full"]);
export const syncStatusEnum = pgEnum("sync_status", ["running", "completed", "failed", "queued", "retrying"]);
export const triggeredByEnum = pgEnum("triggered_by", ["manual", "scheduled", "webhook"]);
export const auditActionEnum = pgEnum("audit_action", [
  "login",
  "logout",
  "user_created",
  "user_updated",
  "user_deleted",
  "password_changed",
  "password_reset",
  "permission_granted",
  "permission_revoked"
]);

/**
 * Core user table backing auth flow.
 * Sistema simplificado: apenas email/senha para uso interno
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  
  // Senha sempre obrigatória (hash bcrypt)
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  
  // Sistema de permissões (JSON array)
  // Exemplo: ["manage_users", "manage_settings"]
  permissions: text("permissions").default('[]').notNull(),
  
  // Roles: master (primeiro usuário), admin (com permissões), user (comum)
  role: roleEnum("role").default("user").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tokens para recuperação de senha
 */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * Sessões ativas dos usuários
 */
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  
  // Informações da sessão
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  deviceInfo: text("deviceInfo"), // JSON com informações do dispositivo
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  lastActivity: timestamp("lastActivity").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_sessions_user_id_idx").on(table.userId),
  tokenIdx: uniqueIndex("user_sessions_token_idx").on(table.token),
}));

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

/**
 * Logs de auditoria
 */
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: 'set null' }),
  action: auditActionEnum("action").notNull(),
  
  // Detalhes da ação (JSON)
  details: text("details"),
  
  // Informações de contexto
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  // Usuário afetado (para ações de gestão de usuários)
  targetUserId: integer("targetUserId").references(() => users.id, { onDelete: 'set null' }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Configurações de integração com Bling
 */
export const blingConfig = pgTable("bling_config", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  clientId: varchar("clientId", { length: 255 }),
  clientSecret: varchar("clientSecret", { length: 255 }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  isActive: boolean("isActive").default(false).notNull(),
  lastSync: timestamp("lastSync"),
  lastNotificationSent: timestamp("lastNotificationSent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BlingConfig = typeof blingConfig.$inferSelect;
export type InsertBlingConfig = typeof blingConfig.$inferInsert;

/**
 * Produtos sincronizados do Bling
 */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  blingId: varchar("blingId", { length: 64 }).notNull().unique(),
  code: varchar("code", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: integer("price").notNull().default(0),
  cost: integer("cost").notNull().default(0),
  unit: varchar("unit", { length: 20 }),
  
  abcClass: abcClassEnum("abcClass"),
  abcRevenue: integer("abcRevenue").default(0).notNull(),
  abcPercentage: integer("abcPercentage").default(0).notNull(),
  abcLastCalculated: timestamp("abcLastCalculated"),
  abcClassManual: boolean("abcClassManual").default(false).notNull(),
  
  shouldStock: boolean("shouldStock").default(true).notNull(),
  minStock: integer("minStock").default(0).notNull(),
  maxStock: integer("maxStock").default(0).notNull(),
  reorderPoint: integer("reorderPoint").default(0).notNull(),
  safetyStock: integer("safetyStock").default(0).notNull(),
  
  avgSales12Months: integer("avgSales12Months").default(0).notNull(),
  suggestedOrderQty: integer("suggestedOrderQty").default(0).notNull(),
  lastSaleDate: timestamp("lastSaleDate"),
  
  isNew: boolean("isNew").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  blingIdIdx: uniqueIndex("products_bling_id_idx").on(table.blingId),
  abcClassIdx: index("products_abc_class_idx").on(table.abcClass),
  isActiveIdx: index("products_is_active_idx").on(table.isActive),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Estoque atual dos produtos
 */
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  depositId: varchar("depositId", { length: 64 }),
  depositName: varchar("depositName", { length: 255 }),
  
  virtualStock: integer("virtualStock").notNull().default(0),
  physicalStock: integer("physicalStock").notNull().default(0),
  reservedStock: integer("reservedStock").notNull().default(0),
  
  lastPhysicalCount: timestamp("lastPhysicalCount"),
  lastVirtualSync: timestamp("lastVirtualSync"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("inventory_product_id_idx").on(table.productId),
}));

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

/**
 * Pedidos de venda
 */
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  blingId: varchar("blingId", { length: 64 }).notNull().unique(),
  orderNumber: varchar("orderNumber", { length: 100 }).notNull(),
  
  customerName: varchar("customerName", { length: 255 }),
  customerDocument: varchar("customerDocument", { length: 20 }),
  
  status: varchar("status", { length: 50 }),
  statusId: integer("statusId"),
  
  totalAmount: integer("totalAmount").notNull().default(0),
  itemsCount: integer("itemsCount").notNull().default(0),
  
  orderDate: timestamp("orderDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  blingIdIdx: uniqueIndex("orders_bling_id_idx").on(table.blingId),
  orderDateIdx: index("orders_order_date_idx").on(table.orderDate),
}));

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Histórico de vendas
 */
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  blingOrderId: varchar("blingOrderId", { length: 64 }).notNull(),
  productId: integer("productId").notNull(),
  
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unitPrice").notNull(),
  totalPrice: integer("totalPrice").notNull(),
  
  orderStatus: varchar("orderStatus", { length: 50 }),
  saleDate: timestamp("saleDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("sales_product_id_idx").on(table.productId),
  saleDateIdx: index("sales_sale_date_idx").on(table.saleDate),
  blingOrderIdIdx: index("sales_bling_order_id_idx").on(table.blingOrderId),
}));

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

/**
 * Histórico de contagens de inventário
 */
export const inventoryCounts = pgTable("inventory_counts", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  userId: integer("userId").notNull(),
  
  expectedQty: integer("expectedQty").notNull(),
  countedQty: integer("countedQty").notNull(),
  variance: integer("variance").notNull(),
  
  countType: countTypeEnum("countType").notNull(),
  notes: text("notes"),
  
  countDate: timestamp("countDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("inventory_counts_product_id_idx").on(table.productId),
  countDateIdx: index("inventory_counts_count_date_idx").on(table.countDate),
}));

export type InventoryCount = typeof inventoryCounts.$inferSelect;
export type InsertInventoryCount = typeof inventoryCounts.$inferInsert;

/**
 * Alertas do sistema
 */
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  
  alertType: alertTypeEnum("alertType").notNull(),
  severity: severityEnum("severity").notNull(),
  message: text("message").notNull(),
  
  isRead: boolean("isRead").default(false).notNull(),
  isResolved: boolean("isResolved").default(false).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: integer("resolvedBy"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("alerts_product_id_idx").on(table.productId),
  isResolvedIdx: index("alerts_is_resolved_idx").on(table.isResolved),
}));

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Agenda de contagens cíclicas
 */
export const countSchedule = pgTable("count_schedule", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  
  frequency: frequencyEnum("frequency").notNull(),
  nextCountDate: timestamp("nextCountDate").notNull(),
  lastCountDate: timestamp("lastCountDate"),
  
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("count_schedule_product_id_idx").on(table.productId),
  nextCountDateIdx: index("count_schedule_next_count_date_idx").on(table.nextCountDate),
}));

export type CountSchedule = typeof countSchedule.$inferSelect;
export type InsertCountSchedule = typeof countSchedule.$inferInsert;

/**
 * Histórico de sincronizações
 */
export const syncHistory = pgTable("sync_history", {
  id: serial("id").primaryKey(),
  syncType: syncTypeEnum("sync_type").notNull(),
  status: syncStatusEnum("status").notNull(),
  itemsSynced: integer("items_synced").default(0).notNull(),
  itemsErrors: integer("items_errors").default(0).notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  triggeredBy: triggeredByEnum("triggered_by").notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  maxRetries: integer("max_retries").default(3).notNull(),
  nextRetryAt: timestamp("next_retry_at"),
}, (table) => ({
  startedAtIdx: index("sync_history_started_at_idx").on(table.startedAt),
  statusIdx: index("sync_history_status_idx").on(table.status),
}));

export type SyncHistory = typeof syncHistory.$inferSelect;
export type InsertSyncHistory = typeof syncHistory.$inferInsert;

/**
 * Configurações de sincronização automática
 */
export const syncConfig = pgTable("sync_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  autoSyncEnabled: boolean("auto_sync_enabled").default(false).notNull(),
  syncFrequencyHours: integer("sync_frequency_hours").default(24).notNull(),
  lastAutoSync: timestamp("last_auto_sync"),
  nextAutoSync: timestamp("next_auto_sync"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SyncConfig = typeof syncConfig.$inferSelect;
export type InsertSyncConfig = typeof syncConfig.$inferInsert;

/**
 * Rastreamento de uso da API do Bling
 */
export const apiUsageLog = pgTable("api_usage_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  endpoint: varchar("endpoint", { length: 2000 }).notNull(),
  method: varchar("method", { length: 10 }).notNull().default("GET"),
  statusCode: integer("status_code").notNull(),
  responseTime: integer("response_time"),
  isRateLimitError: boolean("is_rate_limit_error").default(false).notNull(),
  retryAttempt: integer("retry_attempt").default(0).notNull(),
  circuitBreakerActive: boolean("circuit_breaker_active").default(false).notNull(),
  syncHistoryId: integer("sync_history_id"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  timestampIdx: index("api_usage_log_timestamp_idx").on(table.timestamp),
}));

export type ApiUsageLog = typeof apiUsageLog.$inferSelect;
export type InsertApiUsageLog = typeof apiUsageLog.$inferInsert;

/**
 * Registro de webhooks recebidos do Bling
 */
export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id", { length: 64 }).notNull().unique(),
  resource: varchar("resource", { length: 50 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  companyId: varchar("company_id", { length: 64 }),
  version: varchar("version", { length: 10 }).default("v1").notNull(),
  payload: text("payload").notNull(),
  processed: boolean("processed").default(false).notNull(),
  processedAt: timestamp("processed_at"),
  error: text("error"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: uniqueIndex("webhook_events_event_id_idx").on(table.eventId),
  resourceActionIdx: index("webhook_events_resource_action_idx").on(table.resource, table.action),
  receivedAtIdx: index("webhook_events_received_at_idx").on(table.receivedAt),
}));

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;

/**
 * Produto Fornecedor
 */
export const productSuppliers = pgTable("product_suppliers", {
  id: serial("id").primaryKey(),
  blingId: varchar("blingId", { length: 64 }).notNull().unique(),
  
  productId: integer("productId").notNull(),
  blingProductId: varchar("blingProductId", { length: 64 }).notNull(),
  
  supplierId: varchar("supplierId", { length: 64 }).notNull(),
  supplierName: varchar("supplierName", { length: 255 }),
  
  description: text("description"),
  code: varchar("code", { length: 100 }),
  
  costPrice: integer("costPrice").default(0).notNull(),
  purchasePrice: integer("purchasePrice").default(0).notNull(),
  
  isDefault: boolean("isDefault").default(false).notNull(),
  warranty: integer("warranty").default(0),
  leadTimeDays: integer("leadTimeDays").default(0).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  blingIdIdx: uniqueIndex("product_suppliers_bling_id_idx").on(table.blingId),
  productIdIdx: index("product_suppliers_product_id_idx").on(table.productId),
}));

export type ProductSupplier = typeof productSuppliers.$inferSelect;
export type InsertProductSupplier = typeof productSuppliers.$inferInsert;

/**
 * Situações de pedidos válidas
 */
export const validOrderStatuses = pgTable("valid_order_statuses", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  statusId: integer("statusId").notNull(),
  statusName: varchar("statusName", { length: 100 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ValidOrderStatus = typeof validOrderStatuses.$inferSelect;
export type InsertValidOrderStatus = typeof validOrderStatuses.$inferInsert;

/**
 * Configuração de análise ABC
 */
export const abcConfig = pgTable("abc_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  classAPercentage: integer("class_a_percentage").default(8000).notNull(),
  classBPercentage: integer("class_b_percentage").default(1500).notNull(),
  classCPercentage: integer("class_c_percentage").default(500).notNull(),
  analysisMonths: integer("analysis_months").default(12).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AbcConfig = typeof abcConfig.$inferSelect;
export type InsertAbcConfig = typeof abcConfig.$inferInsert;

/**
 * Histórico de classificações ABC
 */
export const abcHistory = pgTable("abc_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  previousClass: abcClassEnum("previous_class"),
  newClass: abcClassEnum("new_class").notNull(),
  revenue: integer("revenue").notNull(),
  percentage: integer("percentage").notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("abc_history_product_id_idx").on(table.productId),
  calculatedAtIdx: index("abc_history_calculated_at_idx").on(table.calculatedAt),
}));

export type AbcHistory = typeof abcHistory.$inferSelect;
export type InsertAbcHistory = typeof abcHistory.$inferInsert;

/**
 * Configuração de cálculo automático ABC
 */
export const abcAutoCalculationConfig = pgTable("abc_auto_calculation_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  frequencyDays: integer("frequency_days").default(30).notNull(),
  lastCalculation: timestamp("last_calculation"),
  nextCalculation: timestamp("next_calculation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AbcAutoCalculationConfig = typeof abcAutoCalculationConfig.$inferSelect;
export type InsertAbcAutoCalculationConfig = typeof abcAutoCalculationConfig.$inferInsert;

/**
 * Log de cálculos ABC
 */
export const abcCalculationLog = pgTable("abc_calculation_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productsAnalyzed: integer("products_analyzed").notNull(),
  classACount: integer("class_a_count").notNull(),
  classBCount: integer("class_b_count").notNull(),
  classCCount: integer("class_c_count").notNull(),
  classDCount: integer("class_d_count").notNull(),
  totalRevenue: integer("total_revenue").notNull(),
  analysisMonths: integer("analysis_months").notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
}, (table) => ({
  calculatedAtIdx: index("abc_calculation_log_calculated_at_idx").on(table.calculatedAt),
}));

export type AbcCalculationLog = typeof abcCalculationLog.$inferSelect;
export type InsertAbcCalculationLog = typeof abcCalculationLog.$inferInsert;

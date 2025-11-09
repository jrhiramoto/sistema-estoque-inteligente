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

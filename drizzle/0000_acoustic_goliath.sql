CREATE TYPE "public"."abc_class" AS ENUM('A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('low_stock', 'reorder_needed', 'excess_stock', 'inventory_variance', 'negative_stock', 'recount_needed');--> statement-breakpoint
CREATE TYPE "public"."count_type" AS ENUM('scheduled', 'alert', 'manual');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'biannual', 'annual');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'completed', 'failed', 'queued', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."sync_type" AS ENUM('products', 'inventory', 'sales', 'suppliers', 'full');--> statement-breakpoint
CREATE TYPE "public"."triggered_by" AS ENUM('manual', 'scheduled', 'webhook');--> statement-breakpoint
CREATE TABLE "abc_auto_calculation_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"frequency_days" integer DEFAULT 30 NOT NULL,
	"last_calculation" timestamp,
	"next_calculation" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abc_calculation_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"products_analyzed" integer NOT NULL,
	"class_a_count" integer NOT NULL,
	"class_b_count" integer NOT NULL,
	"class_c_count" integer NOT NULL,
	"class_d_count" integer NOT NULL,
	"total_revenue" integer NOT NULL,
	"analysis_months" integer NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abc_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"class_a_percentage" integer DEFAULT 8000 NOT NULL,
	"class_b_percentage" integer DEFAULT 1500 NOT NULL,
	"class_c_percentage" integer DEFAULT 500 NOT NULL,
	"analysis_months" integer DEFAULT 12 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abc_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"previous_class" "abc_class",
	"new_class" "abc_class" NOT NULL,
	"revenue" integer NOT NULL,
	"percentage" integer NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"alertType" "alert_type" NOT NULL,
	"severity" "severity" NOT NULL,
	"message" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"isResolved" boolean DEFAULT false NOT NULL,
	"resolvedAt" timestamp,
	"resolvedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" varchar(2000) NOT NULL,
	"method" varchar(10) DEFAULT 'GET' NOT NULL,
	"status_code" integer NOT NULL,
	"response_time" integer,
	"is_rate_limit_error" boolean DEFAULT false NOT NULL,
	"retry_attempt" integer DEFAULT 0 NOT NULL,
	"circuit_breaker_active" boolean DEFAULT false NOT NULL,
	"sync_history_id" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bling_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"clientId" varchar(255),
	"clientSecret" varchar(255),
	"accessToken" text,
	"refreshToken" text,
	"tokenExpiresAt" timestamp,
	"isActive" boolean DEFAULT false NOT NULL,
	"lastSync" timestamp,
	"lastNotificationSent" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "count_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"frequency" "frequency" NOT NULL,
	"nextCountDate" timestamp NOT NULL,
	"lastCountDate" timestamp,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"depositId" varchar(64),
	"depositName" varchar(255),
	"virtualStock" integer DEFAULT 0 NOT NULL,
	"physicalStock" integer DEFAULT 0 NOT NULL,
	"reservedStock" integer DEFAULT 0 NOT NULL,
	"lastPhysicalCount" timestamp,
	"lastVirtualSync" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_counts" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"userId" integer NOT NULL,
	"expectedQty" integer NOT NULL,
	"countedQty" integer NOT NULL,
	"variance" integer NOT NULL,
	"countType" "count_type" NOT NULL,
	"notes" text,
	"countDate" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"blingId" varchar(64) NOT NULL,
	"orderNumber" varchar(100) NOT NULL,
	"customerName" varchar(255),
	"customerDocument" varchar(20),
	"status" varchar(50),
	"statusId" integer,
	"totalAmount" integer DEFAULT 0 NOT NULL,
	"itemsCount" integer DEFAULT 0 NOT NULL,
	"orderDate" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_blingId_unique" UNIQUE("blingId")
);
--> statement-breakpoint
CREATE TABLE "product_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"blingId" varchar(64) NOT NULL,
	"productId" integer NOT NULL,
	"blingProductId" varchar(64) NOT NULL,
	"supplierId" varchar(64) NOT NULL,
	"supplierName" varchar(255),
	"description" text,
	"code" varchar(100),
	"costPrice" integer DEFAULT 0 NOT NULL,
	"purchasePrice" integer DEFAULT 0 NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"warranty" integer DEFAULT 0,
	"leadTimeDays" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_suppliers_blingId_unique" UNIQUE("blingId")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"blingId" varchar(64) NOT NULL,
	"code" varchar(100),
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" integer DEFAULT 0 NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"unit" varchar(20),
	"abcClass" "abc_class",
	"abcRevenue" integer DEFAULT 0 NOT NULL,
	"abcPercentage" integer DEFAULT 0 NOT NULL,
	"abcLastCalculated" timestamp,
	"abcClassManual" boolean DEFAULT false NOT NULL,
	"shouldStock" boolean DEFAULT true NOT NULL,
	"minStock" integer DEFAULT 0 NOT NULL,
	"maxStock" integer DEFAULT 0 NOT NULL,
	"reorderPoint" integer DEFAULT 0 NOT NULL,
	"safetyStock" integer DEFAULT 0 NOT NULL,
	"avgSales12Months" integer DEFAULT 0 NOT NULL,
	"suggestedOrderQty" integer DEFAULT 0 NOT NULL,
	"lastSaleDate" timestamp,
	"isNew" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_blingId_unique" UNIQUE("blingId")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"blingOrderId" varchar(64) NOT NULL,
	"productId" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unitPrice" integer NOT NULL,
	"totalPrice" integer NOT NULL,
	"orderStatus" varchar(50),
	"saleDate" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"auto_sync_enabled" boolean DEFAULT false NOT NULL,
	"sync_frequency_hours" integer DEFAULT 24 NOT NULL,
	"last_auto_sync" timestamp,
	"next_auto_sync" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_type" "sync_type" NOT NULL,
	"status" "sync_status" NOT NULL,
	"items_synced" integer DEFAULT 0 NOT NULL,
	"items_errors" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"error_message" text,
	"triggered_by" "triggered_by" NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "valid_order_statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"statusId" integer NOT NULL,
	"statusName" varchar(100) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar(64) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(20) NOT NULL,
	"company_id" varchar(64),
	"version" varchar(10) DEFAULT 'v1' NOT NULL,
	"payload" text NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"error" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE INDEX "abc_calculation_log_calculated_at_idx" ON "abc_calculation_log" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX "abc_history_product_id_idx" ON "abc_history" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "abc_history_calculated_at_idx" ON "abc_history" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX "alerts_product_id_idx" ON "alerts" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "alerts_is_resolved_idx" ON "alerts" USING btree ("isResolved");--> statement-breakpoint
CREATE INDEX "api_usage_log_timestamp_idx" ON "api_usage_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "count_schedule_product_id_idx" ON "count_schedule" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "count_schedule_next_count_date_idx" ON "count_schedule" USING btree ("nextCountDate");--> statement-breakpoint
CREATE INDEX "inventory_product_id_idx" ON "inventory" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "inventory_counts_product_id_idx" ON "inventory_counts" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "inventory_counts_count_date_idx" ON "inventory_counts" USING btree ("countDate");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_bling_id_idx" ON "orders" USING btree ("blingId");--> statement-breakpoint
CREATE INDEX "orders_order_date_idx" ON "orders" USING btree ("orderDate");--> statement-breakpoint
CREATE UNIQUE INDEX "product_suppliers_bling_id_idx" ON "product_suppliers" USING btree ("blingId");--> statement-breakpoint
CREATE INDEX "product_suppliers_product_id_idx" ON "product_suppliers" USING btree ("productId");--> statement-breakpoint
CREATE UNIQUE INDEX "products_bling_id_idx" ON "products" USING btree ("blingId");--> statement-breakpoint
CREATE INDEX "products_abc_class_idx" ON "products" USING btree ("abcClass");--> statement-breakpoint
CREATE INDEX "products_is_active_idx" ON "products" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "sales_product_id_idx" ON "sales" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "sales_sale_date_idx" ON "sales" USING btree ("saleDate");--> statement-breakpoint
CREATE INDEX "sales_bling_order_id_idx" ON "sales" USING btree ("blingOrderId");--> statement-breakpoint
CREATE INDEX "sync_history_started_at_idx" ON "sync_history" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sync_history_status_idx" ON "sync_history" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_event_id_idx" ON "webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_resource_action_idx" ON "webhook_events" USING btree ("resource","action");--> statement-breakpoint
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events" USING btree ("received_at");
ALTER TABLE `product_suppliers` ADD `leadTimeDays` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `isNew` boolean DEFAULT false NOT NULL;
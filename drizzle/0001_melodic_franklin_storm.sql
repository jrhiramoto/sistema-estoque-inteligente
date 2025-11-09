CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`alertType` enum('low_stock','reorder_needed','excess_stock','inventory_variance','negative_stock','recount_needed') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`isResolved` boolean NOT NULL DEFAULT false,
	`resolvedAt` timestamp,
	`resolvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bling_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(255),
	`clientSecret` varchar(255),
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT false,
	`lastSync` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bling_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `count_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`frequency` enum('weekly','biweekly','monthly','quarterly','biannual','annual') NOT NULL,
	`nextCountDate` timestamp NOT NULL,
	`lastCountDate` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `count_schedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`depositId` varchar(64),
	`depositName` varchar(255),
	`virtualStock` int NOT NULL DEFAULT 0,
	`physicalStock` int NOT NULL DEFAULT 0,
	`reservedStock` int NOT NULL DEFAULT 0,
	`lastPhysicalCount` timestamp,
	`lastVirtualSync` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_counts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`userId` int NOT NULL,
	`expectedQty` int NOT NULL,
	`countedQty` int NOT NULL,
	`variance` int NOT NULL,
	`countType` enum('scheduled','alert','manual') NOT NULL,
	`notes` text,
	`countDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_counts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blingId` varchar(64) NOT NULL,
	`code` varchar(100),
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` int NOT NULL DEFAULT 0,
	`cost` int NOT NULL DEFAULT 0,
	`unit` varchar(20),
	`abcClass` enum('A','B','C'),
	`abcClassManual` boolean NOT NULL DEFAULT false,
	`shouldStock` boolean NOT NULL DEFAULT true,
	`minStock` int NOT NULL DEFAULT 0,
	`maxStock` int NOT NULL DEFAULT 0,
	`reorderPoint` int NOT NULL DEFAULT 0,
	`safetyStock` int NOT NULL DEFAULT 0,
	`avgSales12Months` int NOT NULL DEFAULT 0,
	`suggestedOrderQty` int NOT NULL DEFAULT 0,
	`lastSaleDate` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_blingId_unique` UNIQUE(`blingId`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blingOrderId` varchar(64) NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` int NOT NULL,
	`totalPrice` int NOT NULL,
	`saleDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);

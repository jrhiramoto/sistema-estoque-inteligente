CREATE TABLE `product_suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blingId` varchar(64) NOT NULL,
	`productId` int NOT NULL,
	`blingProductId` varchar(64) NOT NULL,
	`supplierId` varchar(64) NOT NULL,
	`supplierName` varchar(255),
	`description` text,
	`code` varchar(100),
	`costPrice` int NOT NULL DEFAULT 0,
	`purchasePrice` int NOT NULL DEFAULT 0,
	`isDefault` boolean NOT NULL DEFAULT false,
	`warranty` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_suppliers_blingId_unique` UNIQUE(`blingId`)
);

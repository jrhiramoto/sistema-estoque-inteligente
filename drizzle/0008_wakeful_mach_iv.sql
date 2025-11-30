CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blingId` varchar(64) NOT NULL,
	`orderNumber` varchar(100) NOT NULL,
	`customerName` varchar(255),
	`customerDocument` varchar(20),
	`status` varchar(50),
	`statusId` int,
	`totalAmount` int NOT NULL DEFAULT 0,
	`itemsCount` int NOT NULL DEFAULT 0,
	`orderDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_blingId_unique` UNIQUE(`blingId`)
);

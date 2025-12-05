CREATE TABLE `abc_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`analysisMonths` int NOT NULL DEFAULT 12,
	`lastCalculation` timestamp,
	`autoRecalculate` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `abc_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `abc_config_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `abcClass` enum('A','B','C','D');--> statement-breakpoint
ALTER TABLE `products` ADD `abcRevenue` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `abcPercentage` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `abcLastCalculated` timestamp;
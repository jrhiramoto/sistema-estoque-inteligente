CREATE TABLE `abc_auto_calculation_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`frequency` enum('daily','weekly','biweekly','monthly') NOT NULL DEFAULT 'weekly',
	`lastCalculationAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `abc_auto_calculation_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `abc_auto_calculation_config_userId_unique` UNIQUE(`userId`)
);

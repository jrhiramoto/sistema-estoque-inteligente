CREATE TABLE `abc_calculation_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('manual','automatic') NOT NULL,
	`status` enum('success','failed') NOT NULL,
	`duration` int NOT NULL,
	`totalProducts` int NOT NULL DEFAULT 0,
	`classA` int NOT NULL DEFAULT 0,
	`classB` int NOT NULL DEFAULT 0,
	`classC` int NOT NULL DEFAULT 0,
	`classD` int NOT NULL DEFAULT 0,
	`changedProducts` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`executedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `abc_calculation_log_id` PRIMARY KEY(`id`)
);

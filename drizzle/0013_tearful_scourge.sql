CREATE TABLE `abc_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`abcClass` enum('A','B','C','D') NOT NULL,
	`abcRevenue` int NOT NULL DEFAULT 0,
	`abcPercentage` int NOT NULL DEFAULT 0,
	`calculatedAt` timestamp NOT NULL,
	`analysisMonths` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `abc_history_id` PRIMARY KEY(`id`)
);

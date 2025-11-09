CREATE TABLE `sync_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`auto_sync_enabled` boolean NOT NULL DEFAULT false,
	`sync_frequency_hours` int NOT NULL DEFAULT 24,
	`last_auto_sync` timestamp,
	`next_auto_sync` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sync_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sync_type` enum('products','inventory','sales','full') NOT NULL,
	`status` enum('running','completed','failed') NOT NULL,
	`items_synced` int NOT NULL DEFAULT 0,
	`items_errors` int NOT NULL DEFAULT 0,
	`started_at` timestamp NOT NULL,
	`completed_at` timestamp,
	`error_message` text,
	`triggered_by` enum('manual','scheduled','webhook') NOT NULL,
	CONSTRAINT `sync_history_id` PRIMARY KEY(`id`)
);

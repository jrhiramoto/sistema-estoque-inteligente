ALTER TABLE `sync_history` MODIFY COLUMN `status` enum('running','completed','failed','queued','retrying') NOT NULL;--> statement-breakpoint
ALTER TABLE `sync_history` ADD `retry_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sync_history` ADD `max_retries` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `sync_history` ADD `next_retry_at` timestamp;
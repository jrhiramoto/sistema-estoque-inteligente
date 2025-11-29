CREATE TABLE `webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`resource` varchar(50) NOT NULL,
	`action` varchar(20) NOT NULL,
	`company_id` varchar(64),
	`version` varchar(10) NOT NULL DEFAULT 'v1',
	`payload` text NOT NULL,
	`processed` boolean NOT NULL DEFAULT false,
	`processed_at` timestamp,
	`error` text,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_events_event_id_unique` UNIQUE(`event_id`)
);

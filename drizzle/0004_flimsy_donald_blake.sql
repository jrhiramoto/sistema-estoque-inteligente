CREATE TABLE `api_usage_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`method` varchar(10) NOT NULL DEFAULT 'GET',
	`status_code` int NOT NULL,
	`response_time` int,
	`is_rate_limit_error` boolean NOT NULL DEFAULT false,
	`retry_attempt` int NOT NULL DEFAULT 0,
	`circuit_breaker_active` boolean NOT NULL DEFAULT false,
	`sync_history_id` int,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_usage_log_id` PRIMARY KEY(`id`)
);

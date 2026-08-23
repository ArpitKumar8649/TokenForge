CREATE TABLE `claude_opus5_failure_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`sourceType` enum('provider','render') NOT NULL,
	`sourceId` varchar(96) NOT NULL,
	`sourceLabel` varchar(128) NOT NULL,
	`httpStatus` int,
	`failureKind` varchar(32) NOT NULL,
	`retryable` boolean NOT NULL DEFAULT false,
	`callerMessage` varchar(512) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claude_opus5_failure_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `claude_opus5_failure_logs_occurred_idx` ON `claude_opus5_failure_logs` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `claude_opus5_failure_logs_source_occurred_idx` ON `claude_opus5_failure_logs` (`sourceType`,`sourceId`,`occurredAt`);
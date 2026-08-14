CREATE TABLE `login_attempts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`identifierHash` varchar(128) NOT NULL,
	`failureCount` int NOT NULL DEFAULT 0,
	`windowStartedAt` timestamp NOT NULL DEFAULT (now()),
	`blockedUntil` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `login_attempts_identifierHash_unique` UNIQUE(`identifierHash`)
);
--> statement-breakpoint
CREATE INDEX `login_attempts_blocked_idx` ON `login_attempts` (`blockedUntil`);
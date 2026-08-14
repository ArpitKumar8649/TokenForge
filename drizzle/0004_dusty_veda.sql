CREATE TABLE `credit_accounts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balanceNanos` bigint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_accounts_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `credit_ledger` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('introductory_grant','daily_checkin','usage_debit','manual_adjustment') NOT NULL,
	`amountNanos` bigint NOT NULL,
	`balanceAfterNanos` bigint NOT NULL,
	`referenceId` varchar(128),
	`note` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_ledger_user_reference_unique_idx` UNIQUE(`userId`,`referenceId`)
);
--> statement-breakpoint
CREATE TABLE `daily_checkins` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`checkinDate` date NOT NULL,
	`rewardNanos` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_checkins_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_checkins_user_date_unique_idx` UNIQUE(`userId`,`checkinDate`)
);
--> statement-breakpoint
ALTER TABLE `usage_events` ADD `source` enum('api','playground') DEFAULT 'api' NOT NULL;--> statement-breakpoint
ALTER TABLE `usage_events` ADD `stream` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `usage_events` ADD `chargeNanos` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `credit_accounts` ADD CONSTRAINT `credit_accounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_ledger` ADD CONSTRAINT `credit_ledger_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_checkins` ADD CONSTRAINT `daily_checkins_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `credit_accounts_balance_idx` ON `credit_accounts` (`balanceNanos`);--> statement-breakpoint
CREATE INDEX `credit_ledger_user_time_idx` ON `credit_ledger` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `daily_checkins_user_date_idx` ON `daily_checkins` (`userId`,`checkinDate`);--> statement-breakpoint
CREATE INDEX `usage_events_user_status_time_idx` ON `usage_events` (`userId`,`status`,`createdAt`);
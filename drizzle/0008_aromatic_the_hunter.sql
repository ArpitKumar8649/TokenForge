CREATE TABLE `referral_attributions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`referrerUserId` int NOT NULL,
	`referredUserId` int NOT NULL,
	`rewardNanos` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_attributions_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_attributions_referredUserId_unique` UNIQUE(`referredUserId`)
);
--> statement-breakpoint
CREATE TABLE `referral_codes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(24) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_codes_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `referral_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `credit_ledger` MODIFY COLUMN `kind` enum('introductory_grant','daily_checkin','usage_debit','manual_adjustment','referral_reward') NOT NULL;--> statement-breakpoint
ALTER TABLE `referral_attributions` ADD CONSTRAINT `referral_attributions_referrerUserId_users_id_fk` FOREIGN KEY (`referrerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referral_attributions` ADD CONSTRAINT `referral_attributions_referredUserId_users_id_fk` FOREIGN KEY (`referredUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referral_codes` ADD CONSTRAINT `referral_codes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `referral_attributions_referrer_time_idx` ON `referral_attributions` (`referrerUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `referral_codes_code_idx` ON `referral_codes` (`code`);
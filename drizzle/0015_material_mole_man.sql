CREATE TABLE `special_referral_claims` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`campaignKey` varchar(64) NOT NULL,
	`slotNumber` int NOT NULL,
	`userId` int NOT NULL,
	`reservedAt` timestamp NOT NULL DEFAULT (now()),
	`verifiedAt` timestamp,
	`awardedAt` timestamp,
	`giftViewedAt` timestamp,
	CONSTRAINT `special_referral_claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `special_referral_claims_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `special_referral_claims_campaign_slot_unique_idx` UNIQUE(`campaignKey`,`slotNumber`)
);
--> statement-breakpoint
ALTER TABLE `credit_ledger` MODIFY COLUMN `kind` enum('introductory_grant','daily_checkin','usage_debit','manual_adjustment','referral_reward','special_referral_bonus') NOT NULL;--> statement-breakpoint
ALTER TABLE `special_referral_claims` ADD CONSTRAINT `special_referral_claims_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `special_referral_claims_campaign_verified_idx` ON `special_referral_claims` (`campaignKey`,`verifiedAt`,`awardedAt`);
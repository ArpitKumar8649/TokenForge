CREATE TABLE `credit_giveaway_notifications` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`giveawayId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`dismissedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_giveaway_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_giveaway_notifications_giveaway_user_unique_idx` UNIQUE(`giveawayId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `credit_giveaway_notifications` ADD CONSTRAINT `credit_giveaway_notifications_giveawayId_credit_giveaways_id_fk` FOREIGN KEY (`giveawayId`) REFERENCES `credit_giveaways`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_giveaway_notifications` ADD CONSTRAINT `credit_giveaway_notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `credit_giveaway_notifications_user_dismissed_created_idx` ON `credit_giveaway_notifications` (`userId`,`dismissedAt`,`createdAt`);
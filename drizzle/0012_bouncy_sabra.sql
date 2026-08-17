CREATE TABLE `credit_giveaways` (
	`id` varchar(32) NOT NULL,
	`actorUserId` int,
	`amountNanos` bigint NOT NULL,
	`recipientCount` int NOT NULL,
	`totalAmountNanos` bigint NOT NULL,
	`announcementNote` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_giveaways_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `credit_giveaways` ADD CONSTRAINT `credit_giveaways_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `credit_giveaways_created_idx` ON `credit_giveaways` (`createdAt`);
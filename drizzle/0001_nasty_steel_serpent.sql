CREATE TABLE `support_messages` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`senderRole` enum('user','admin') NOT NULL,
	`content` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `usage_events` ADD `rawErrorMessage` text;--> statement-breakpoint
ALTER TABLE `usage_events` ADD `credentialSlot` int;--> statement-breakpoint
ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `support_messages_user_idx` ON `support_messages` (`userId`,`createdAt`);
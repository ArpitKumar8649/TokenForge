CREATE TABLE `oauth_identities` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(32) NOT NULL,
	`providerUserId` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oauth_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_identities_provider_subject_idx` UNIQUE(`provider`,`providerUserId`),
	CONSTRAINT `oauth_identities_user_provider_idx` UNIQUE(`userId`,`provider`)
);
--> statement-breakpoint
ALTER TABLE `oauth_identities` ADD CONSTRAINT `oauth_identities_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
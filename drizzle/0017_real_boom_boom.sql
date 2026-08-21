CREATE TABLE `pre_provisioned_accounts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`introductoryCreditNanos` bigint NOT NULL,
	`provisionedByUserId` int,
	`activatedUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`activatedAt` timestamp,
	CONSTRAINT `pre_provisioned_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `pre_provisioned_accounts_activatedUserId_unique` UNIQUE(`activatedUserId`),
	CONSTRAINT `pre_provisioned_accounts_email_unique_idx` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `pre_provisioned_accounts` ADD CONSTRAINT `pre_provisioned_accounts_provisionedByUserId_users_id_fk` FOREIGN KEY (`provisionedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pre_provisioned_accounts` ADD CONSTRAINT `pre_provisioned_accounts_activatedUserId_users_id_fk` FOREIGN KEY (`activatedUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pre_provisioned_accounts_activation_idx` ON `pre_provisioned_accounts` (`activatedAt`,`createdAt`);
CREATE TABLE `orcarouter_credential_slots` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`slot` int NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` varchar(32) NOT NULL,
	`authTag` varchar(32) NOT NULL,
	`keyFingerprint` varchar(16) NOT NULL,
	`lastValidatedAt` timestamp NOT NULL,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orcarouter_credential_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `orcarouter_credential_slots_slot_unique_idx` UNIQUE(`slot`)
);
--> statement-breakpoint
ALTER TABLE `orcarouter_credential_slots` ADD CONSTRAINT `orcarouter_credential_slots_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
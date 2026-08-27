CREATE TABLE `bai_reasoning_continuations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`modelId` varchar(64) NOT NULL,
	`assistantFingerprint` varchar(64) NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` varchar(32) NOT NULL,
	`authTag` varchar(32) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bai_reasoning_continuations_id` PRIMARY KEY(`id`),
	CONSTRAINT `bai_reasoning_continuation_user_model_message_unique_idx` UNIQUE(`userId`,`modelId`,`assistantFingerprint`)
);
--> statement-breakpoint
ALTER TABLE `bai_reasoning_continuations` ADD CONSTRAINT `bai_reasoning_continuations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bai_reasoning_continuation_expires_idx` ON `bai_reasoning_continuations` (`expiresAt`);
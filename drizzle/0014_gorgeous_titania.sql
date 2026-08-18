CREATE TABLE `glm_tool_continuation_states` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`toolCallId` varchar(128) NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` varchar(32) NOT NULL,
	`authTag` varchar(32) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `glm_tool_continuation_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `glm_tool_continuation_user_tool_unique_idx` UNIQUE(`userId`,`toolCallId`)
);
--> statement-breakpoint
ALTER TABLE `glm_tool_continuation_states` ADD CONSTRAINT `glm_tool_continuation_states_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `glm_tool_continuation_expires_idx` ON `glm_tool_continuation_states` (`expiresAt`);
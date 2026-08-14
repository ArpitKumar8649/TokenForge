CREATE TABLE `account_controls` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dailyRequestLimit` int NOT NULL DEFAULT 100,
	`dailyTokenLimit` int NOT NULL DEFAULT 100000,
	`maxConcurrentRequests` int NOT NULL DEFAULT 2,
	`isSuspended` boolean NOT NULL DEFAULT false,
	`isSuspicious` boolean NOT NULL DEFAULT false,
	`suspensionReason` varchar(512),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_controls_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_controls_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `account_flags` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('quota_exceeded','rate_circuit','suspicious_usage') NOT NULL,
	`reason` varchar(512) NOT NULL,
	`status` enum('open','reviewed','dismissed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `account_flags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`keyPrefix` varchar(24) NOT NULL,
	`keyHash` varchar(128) NOT NULL,
	`label` varchar(100) NOT NULL,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`lastUsedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_keyHash_unique` UNIQUE(`keyHash`),
	CONSTRAINT `api_keys_user_label_idx` UNIQUE(`userId`,`label`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`targetUserId` int,
	`action` varchar(128) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_usage` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`apiKeyId` bigint,
	`usageDate` date NOT NULL,
	`modelId` varchar(128) NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`inputTokens` int NOT NULL DEFAULT 0,
	`outputTokens` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_usage_unique_idx` UNIQUE(`userId`,`apiKeyId`,`usageDate`,`modelId`)
);
--> statement-breakpoint
CREATE TABLE `model_configs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`modelId` varchar(128) NOT NULL,
	`providerSlug` varchar(64) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`description` text NOT NULL,
	`capabilities` json NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`contextWindow` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_configs_modelId_unique` UNIQUE(`modelId`)
);
--> statement-breakpoint
CREATE TABLE `provider_configs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`baseUrl` varchar(512) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_configs_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `usage_events` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`requestId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`apiKeyId` bigint,
	`modelId` varchar(128) NOT NULL,
	`status` enum('success','rejected','provider_error','cancelled') NOT NULL,
	`inputTokens` int NOT NULL DEFAULT 0,
	`outputTokens` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`sourceIpHash` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usage_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `usage_events_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
ALTER TABLE `account_controls` ADD CONSTRAINT `account_controls_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account_flags` ADD CONSTRAINT `account_flags_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_targetUserId_users_id_fk` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_usage` ADD CONSTRAINT `daily_usage_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_usage` ADD CONSTRAINT `daily_usage_apiKeyId_api_keys_id_fk` FOREIGN KEY (`apiKeyId`) REFERENCES `api_keys`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_events` ADD CONSTRAINT `usage_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_events` ADD CONSTRAINT `usage_events_apiKeyId_api_keys_id_fk` FOREIGN KEY (`apiKeyId`) REFERENCES `api_keys`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_controls_safety_idx` ON `account_controls` (`isSuspended`,`isSuspicious`);--> statement-breakpoint
CREATE INDEX `account_flags_user_status_idx` ON `account_flags` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `api_keys_user_status_idx` ON `api_keys` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_time_idx` ON `audit_events` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `daily_usage_user_date_idx` ON `daily_usage` (`userId`,`usageDate`);--> statement-breakpoint
CREATE INDEX `model_configs_provider_enabled_idx` ON `model_configs` (`providerSlug`,`enabled`);--> statement-breakpoint
CREATE INDEX `usage_events_user_time_idx` ON `usage_events` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `usage_events_key_time_idx` ON `usage_events` (`apiKeyId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `usage_events_model_time_idx` ON `usage_events` (`modelId`,`createdAt`);
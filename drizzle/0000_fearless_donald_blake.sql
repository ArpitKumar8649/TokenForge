CREATE TABLE `account_controls` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dailyRequestLimit` int NOT NULL DEFAULT 100,
	`dailyTokenLimit` int NOT NULL DEFAULT 100000,
	`maxConcurrentRequests` int NOT NULL DEFAULT 2,
	`isSuspended` boolean NOT NULL DEFAULT false,
	`isSuspicious` boolean NOT NULL DEFAULT false,
	`suspensionReason` varchar(512),
	`discordVerifiedAt` timestamp,
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
CREATE TABLE `admin_access_requests` (
	`id` varchar(32) NOT NULL,
	`email` varchar(320) NOT NULL,
	`status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
	`adminNote` text,
	`submissionCount` int NOT NULL DEFAULT 1,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`resolvedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_access_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_access_requests_email_idx` UNIQUE(`email`)
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
CREATE TABLE `bai_credential_capacity_slots` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`providerModelId` varchar(64) NOT NULL,
	`providerGroupId` varchar(128) NOT NULL,
	`credentialFingerprint` varchar(128) NOT NULL,
	`slot` int NOT NULL,
	`leaseId` varchar(64),
	`leaseExpiresAt` timestamp,
	`acquiredAt` timestamp,
	`releasedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bai_credential_capacity_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `bai_credential_capacity_slot_unique_idx` UNIQUE(`providerModelId`,`providerGroupId`,`credentialFingerprint`,`slot`)
);
--> statement-breakpoint
CREATE TABLE `bai_provider_circuit_states` (
	`providerGroupId` varchar(128) NOT NULL,
	`rateLimitCount` int NOT NULL DEFAULT 0,
	`consecutiveRateLimits` int NOT NULL DEFAULT 0,
	`cooldownUntil` timestamp,
	`lastRateLimitedAt` timestamp,
	`lastSuccessAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bai_provider_circuit_states_providerGroupId` PRIMARY KEY(`providerGroupId`)
);
--> statement-breakpoint
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
CREATE TABLE `bailu_webshare_proxy_slot_metrics` (
	`proxyId` varchar(96) NOT NULL,
	`proxyLabel` varchar(80) NOT NULL,
	`activeRequests` int NOT NULL DEFAULT 0,
	`requestCount` bigint NOT NULL DEFAULT 0,
	`successCount` bigint NOT NULL DEFAULT 0,
	`failureCount` bigint NOT NULL DEFAULT 0,
	`timeoutCount` bigint NOT NULL DEFAULT 0,
	`cooldownUntil` timestamp,
	`lastRequestAt` timestamp,
	`lastSuccessAt` timestamp,
	`lastFailureAt` timestamp,
	`lastFailureKind` varchar(32),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bailu_webshare_proxy_slot_metrics_proxyId` PRIMARY KEY(`proxyId`)
);
--> statement-breakpoint
CREATE TABLE `claude_opus5_failure_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`modelId` varchar(64) NOT NULL DEFAULT 'claude-opus-5',
	`sourceType` enum('provider','render') NOT NULL,
	`sourceId` varchar(96) NOT NULL,
	`sourceLabel` varchar(128) NOT NULL,
	`credentialSlot` int,
	`httpStatus` int,
	`failureKind` varchar(32) NOT NULL,
	`retryable` boolean NOT NULL DEFAULT false,
	`callerMessage` text NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claude_opus5_failure_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_accounts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balanceNanos` bigint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_accounts_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
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
CREATE TABLE `credit_ledger` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('introductory_grant','daily_checkin','usage_debit','manual_adjustment','referral_reward','special_referral_bonus') NOT NULL,
	`amountNanos` bigint NOT NULL,
	`balanceAfterNanos` bigint NOT NULL,
	`referenceId` varchar(128),
	`note` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_ledger_user_reference_unique_idx` UNIQUE(`userId`,`referenceId`)
);
--> statement-breakpoint
CREATE TABLE `credit_tickets` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`userEmail` varchar(320) NOT NULL,
	`userName` varchar(255),
	`type` varchar(64) NOT NULL DEFAULT 'credit_issue',
	`requestedAmountDollars` decimal(12,2) NOT NULL,
	`requestedAmountNanos` bigint NOT NULL,
	`reason` text,
	`status` enum('pending','resolved','rejected') NOT NULL DEFAULT 'pending',
	`approvedAmountDollars` decimal(12,2),
	`approvedAmountNanos` bigint,
	`adminNote` varchar(256),
	`resolvedByUserId` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_checkins` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`checkinDate` date NOT NULL,
	`rewardNanos` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_checkins_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_checkins_user_date_unique_idx` UNIQUE(`userId`,`checkinDate`)
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
CREATE TABLE `deleted_identity_tombstones` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`kind` varchar(32) NOT NULL,
	`identifierHash` varchar(128) NOT NULL,
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deleted_identity_tombstones_id` PRIMARY KEY(`id`),
	CONSTRAINT `deleted_identity_kind_hash_unique_idx` UNIQUE(`kind`,`identifierHash`)
);
--> statement-breakpoint
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
CREATE TABLE `login_attempts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`identifierHash` varchar(128) NOT NULL,
	`failureCount` int NOT NULL DEFAULT 0,
	`windowStartedAt` timestamp NOT NULL DEFAULT (now()),
	`blockedUntil` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `login_attempts_identifierHash_unique` UNIQUE(`identifierHash`)
);
--> statement-breakpoint
CREATE TABLE `managed_provider_model_usage` (
	`providerModelId` varchar(64) NOT NULL,
	`providerGroupId` varchar(96) NOT NULL,
	`modelEntryId` varchar(96) NOT NULL,
	`inputTokens` bigint NOT NULL DEFAULT 0,
	`outputTokens` bigint NOT NULL DEFAULT 0,
	`totalTokens` bigint NOT NULL DEFAULT 0,
	`requestCount` bigint NOT NULL DEFAULT 0,
	`lastUsedAt` timestamp,
	`retiredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managed_provider_model_usage_entry_unique_idx` UNIQUE(`providerModelId`,`providerGroupId`,`modelEntryId`)
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
CREATE TABLE `password_credentials` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `password_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_credentials_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`settingKey` varchar(96) NOT NULL,
	`value` mediumtext NOT NULL,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_settings_settingKey` PRIMARY KEY(`settingKey`)
);
--> statement-breakpoint
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
CREATE TABLE `provider_key_metrics` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`providerModelId` varchar(64) NOT NULL,
	`credentialFingerprint` varchar(64) NOT NULL,
	`requestCount` bigint NOT NULL DEFAULT 0,
	`successCount` bigint NOT NULL DEFAULT 0,
	`failureCount` bigint NOT NULL DEFAULT 0,
	`lastRequestAt` timestamp,
	`lastSuccessAt` timestamp,
	`lastFailureAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_key_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_key_metrics_model_fingerprint_unique_idx` UNIQUE(`providerModelId`,`credentialFingerprint`)
);
--> statement-breakpoint
CREATE TABLE `referral_attributions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`referrerUserId` int NOT NULL,
	`referredUserId` int NOT NULL,
	`rewardNanos` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_attributions_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_attributions_referredUserId_unique` UNIQUE(`referredUserId`)
);
--> statement-breakpoint
CREATE TABLE `referral_codes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(4) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_codes_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `referral_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `render_proxy_endpoint_metrics` (
	`endpointId` varchar(96) NOT NULL,
	`endpointUrl` varchar(512) NOT NULL,
	`activeRequests` int NOT NULL DEFAULT 0,
	`peakActiveRequests` int NOT NULL DEFAULT 0,
	`requestCount` bigint NOT NULL DEFAULT 0,
	`successCount` bigint NOT NULL DEFAULT 0,
	`failureCount` bigint NOT NULL DEFAULT 0,
	`timeoutCount` bigint NOT NULL DEFAULT 0,
	`cooldownUntil` timestamp,
	`lastRequestAt` timestamp,
	`lastSuccessAt` timestamp,
	`lastFailureAt` timestamp,
	`lastHttpStatus` int,
	`lastFailureKind` varchar(32),
	`lastFailureMessage` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `render_proxy_endpoint_metrics_endpointId` PRIMARY KEY(`endpointId`)
);
--> statement-breakpoint
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
CREATE TABLE `usage_events` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`requestId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`apiKeyId` bigint,
	`modelId` varchar(128) NOT NULL,
	`status` enum('success','rejected','provider_error','cancelled') NOT NULL,
	`source` enum('api','playground') NOT NULL DEFAULT 'api',
	`stream` boolean NOT NULL DEFAULT false,
	`inputTokens` int NOT NULL DEFAULT 0,
	`outputTokens` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`chargeNanos` bigint NOT NULL DEFAULT 0,
	`sourceIpHash` varchar(128),
	`latencyMs` int,
	`errorMessage` text,
	`provider` varchar(96),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usage_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `usage_events_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_email_unique_idx` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `account_controls` ADD CONSTRAINT `account_controls_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account_flags` ADD CONSTRAINT `account_flags_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_access_requests` ADD CONSTRAINT `admin_access_requests_resolvedByUserId_users_id_fk` FOREIGN KEY (`resolvedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_targetUserId_users_id_fk` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bai_reasoning_continuations` ADD CONSTRAINT `bai_reasoning_continuations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_accounts` ADD CONSTRAINT `credit_accounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_giveaway_notifications` ADD CONSTRAINT `credit_giveaway_notifications_giveawayId_credit_giveaways_id_fk` FOREIGN KEY (`giveawayId`) REFERENCES `credit_giveaways`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_giveaway_notifications` ADD CONSTRAINT `credit_giveaway_notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_giveaways` ADD CONSTRAINT `credit_giveaways_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_ledger` ADD CONSTRAINT `credit_ledger_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_tickets` ADD CONSTRAINT `credit_tickets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_tickets` ADD CONSTRAINT `credit_tickets_resolvedByUserId_users_id_fk` FOREIGN KEY (`resolvedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_checkins` ADD CONSTRAINT `daily_checkins_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_usage` ADD CONSTRAINT `daily_usage_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_usage` ADD CONSTRAINT `daily_usage_apiKeyId_api_keys_id_fk` FOREIGN KEY (`apiKeyId`) REFERENCES `api_keys`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `glm_tool_continuation_states` ADD CONSTRAINT `glm_tool_continuation_states_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_identities` ADD CONSTRAINT `oauth_identities_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orcarouter_credential_slots` ADD CONSTRAINT `orcarouter_credential_slots_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_credentials` ADD CONSTRAINT `password_credentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD CONSTRAINT `platform_settings_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pre_provisioned_accounts` ADD CONSTRAINT `pre_provisioned_accounts_provisionedByUserId_users_id_fk` FOREIGN KEY (`provisionedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pre_provisioned_accounts` ADD CONSTRAINT `pre_provisioned_accounts_activatedUserId_users_id_fk` FOREIGN KEY (`activatedUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referral_attributions` ADD CONSTRAINT `referral_attributions_referrerUserId_users_id_fk` FOREIGN KEY (`referrerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referral_attributions` ADD CONSTRAINT `referral_attributions_referredUserId_users_id_fk` FOREIGN KEY (`referredUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referral_codes` ADD CONSTRAINT `referral_codes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_referral_claims` ADD CONSTRAINT `special_referral_claims_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_events` ADD CONSTRAINT `usage_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_events` ADD CONSTRAINT `usage_events_apiKeyId_api_keys_id_fk` FOREIGN KEY (`apiKeyId`) REFERENCES `api_keys`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_controls_safety_idx` ON `account_controls` (`isSuspended`,`isSuspicious`);--> statement-breakpoint
CREATE INDEX `account_flags_user_status_idx` ON `account_flags` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `admin_access_requests_status_idx` ON `admin_access_requests` (`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `api_keys_user_status_idx` ON `api_keys` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_time_idx` ON `audit_events` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `bai_credential_capacity_lookup_idx` ON `bai_credential_capacity_slots` (`providerModelId`,`providerGroupId`,`credentialFingerprint`,`leaseExpiresAt`);--> statement-breakpoint
CREATE INDEX `bai_provider_circuit_cooldown_idx` ON `bai_provider_circuit_states` (`cooldownUntil`);--> statement-breakpoint
CREATE INDEX `bai_reasoning_continuation_expires_idx` ON `bai_reasoning_continuations` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `bailu_webshare_proxy_slot_metrics_updated_idx` ON `bailu_webshare_proxy_slot_metrics` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `claude_opus5_failure_logs_occurred_idx` ON `claude_opus5_failure_logs` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `claude_opus5_failure_logs_model_occurred_idx` ON `claude_opus5_failure_logs` (`modelId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `claude_opus5_failure_logs_source_occurred_idx` ON `claude_opus5_failure_logs` (`sourceType`,`sourceId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `credit_accounts_balance_idx` ON `credit_accounts` (`balanceNanos`);--> statement-breakpoint
CREATE INDEX `credit_giveaway_notifications_user_dismissed_created_idx` ON `credit_giveaway_notifications` (`userId`,`dismissedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `credit_giveaways_created_idx` ON `credit_giveaways` (`createdAt`);--> statement-breakpoint
CREATE INDEX `credit_ledger_user_time_idx` ON `credit_ledger` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `credit_tickets_user_idx` ON `credit_tickets` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `credit_tickets_status_idx` ON `credit_tickets` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `daily_checkins_user_date_idx` ON `daily_checkins` (`userId`,`checkinDate`);--> statement-breakpoint
CREATE INDEX `daily_usage_user_date_idx` ON `daily_usage` (`userId`,`usageDate`);--> statement-breakpoint
CREATE INDEX `glm_tool_continuation_expires_idx` ON `glm_tool_continuation_states` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `login_attempts_blocked_idx` ON `login_attempts` (`blockedUntil`);--> statement-breakpoint
CREATE INDEX `managed_provider_model_usage_group_updated_idx` ON `managed_provider_model_usage` (`providerModelId`,`providerGroupId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `model_configs_provider_enabled_idx` ON `model_configs` (`providerSlug`,`enabled`);--> statement-breakpoint
CREATE INDEX `password_credentials_user_idx` ON `password_credentials` (`userId`);--> statement-breakpoint
CREATE INDEX `pre_provisioned_accounts_activation_idx` ON `pre_provisioned_accounts` (`activatedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `provider_key_metrics_model_updated_idx` ON `provider_key_metrics` (`providerModelId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `referral_attributions_referrer_time_idx` ON `referral_attributions` (`referrerUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `referral_codes_code_idx` ON `referral_codes` (`code`);--> statement-breakpoint
CREATE INDEX `render_proxy_endpoint_metrics_updated_idx` ON `render_proxy_endpoint_metrics` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `special_referral_claims_campaign_verified_idx` ON `special_referral_claims` (`campaignKey`,`verifiedAt`,`awardedAt`);--> statement-breakpoint
CREATE INDEX `usage_events_user_time_idx` ON `usage_events` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `usage_events_key_time_idx` ON `usage_events` (`apiKeyId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `usage_events_model_time_idx` ON `usage_events` (`modelId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `usage_events_user_status_time_idx` ON `usage_events` (`userId`,`status`,`createdAt`);
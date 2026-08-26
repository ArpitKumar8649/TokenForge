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
CREATE INDEX `managed_provider_model_usage_group_updated_idx` ON `managed_provider_model_usage` (`providerModelId`,`providerGroupId`,`updatedAt`);
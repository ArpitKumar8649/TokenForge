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
CREATE INDEX `provider_key_metrics_model_updated_idx` ON `provider_key_metrics` (`providerModelId`,`updatedAt`);
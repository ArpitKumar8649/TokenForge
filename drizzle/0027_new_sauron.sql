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
CREATE INDEX `bai_credential_capacity_lookup_idx` ON `bai_credential_capacity_slots` (`providerModelId`,`providerGroupId`,`credentialFingerprint`,`leaseExpiresAt`);
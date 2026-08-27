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
CREATE INDEX `bai_provider_circuit_cooldown_idx` ON `bai_provider_circuit_states` (`cooldownUntil`);
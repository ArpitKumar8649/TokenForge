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
CREATE INDEX `bailu_webshare_proxy_slot_metrics_updated_idx` ON `bailu_webshare_proxy_slot_metrics` (`updatedAt`);
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
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `render_proxy_endpoint_metrics_endpointId` PRIMARY KEY(`endpointId`)
);
--> statement-breakpoint
CREATE INDEX `render_proxy_endpoint_metrics_updated_idx` ON `render_proxy_endpoint_metrics` (`updatedAt`);
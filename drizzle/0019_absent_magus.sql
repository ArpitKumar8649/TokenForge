ALTER TABLE `render_proxy_endpoint_metrics` ADD `lastHttpStatus` int;--> statement-breakpoint
ALTER TABLE `render_proxy_endpoint_metrics` ADD `lastFailureKind` varchar(32);--> statement-breakpoint
ALTER TABLE `render_proxy_endpoint_metrics` ADD `lastFailureMessage` varchar(512);
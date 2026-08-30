ALTER TABLE `usage_events` ADD `latencyMs` int;--> statement-breakpoint
ALTER TABLE `usage_events` ADD `errorMessage` text;--> statement-breakpoint
ALTER TABLE `usage_events` ADD `provider` varchar(96);
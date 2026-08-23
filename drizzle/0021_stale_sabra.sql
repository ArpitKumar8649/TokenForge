ALTER TABLE `claude_opus5_failure_logs` MODIFY COLUMN `callerMessage` text NOT NULL;--> statement-breakpoint
ALTER TABLE `claude_opus5_failure_logs` ADD `modelId` varchar(64) DEFAULT 'claude-opus-5' NOT NULL;--> statement-breakpoint
CREATE INDEX `claude_opus5_failure_logs_model_occurred_idx` ON `claude_opus5_failure_logs` (`modelId`,`occurredAt`);
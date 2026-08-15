CREATE TABLE `deleted_identity_tombstones` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`kind` varchar(32) NOT NULL,
	`identifierHash` varchar(128) NOT NULL,
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deleted_identity_tombstones_id` PRIMARY KEY(`id`),
	CONSTRAINT `deleted_identity_kind_hash_unique_idx` UNIQUE(`kind`,`identifierHash`)
);

CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`from_entry_id` text NOT NULL,
	`to_entry_id` text NOT NULL,
	`kind` text DEFAULT 'brings' NOT NULL,
	FOREIGN KEY (`from_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_pair_unique` ON `connections` (`from_entry_id`,`to_entry_id`,`kind`);--> statement-breakpoint
CREATE INDEX `connections_from_idx` ON `connections` (`from_entry_id`);--> statement-breakpoint
CREATE TABLE `cues` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`term` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cues_entry_idx` ON `cues` (`entry_id`);--> statement-breakpoint
CREATE TABLE `direction_tier` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`tier` text DEFAULT 'normal' NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`type_id` text NOT NULL,
	`name` text NOT NULL,
	`embedding_vec` text,
	`embedding_model` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_type_name_unique` ON `entries` (`type_id`,`name`);--> statement-breakpoint
CREATE INDEX `entries_type_idx` ON `entries` (`type_id`);--> statement-breakpoint
CREATE TABLE `facets` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`label` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`mode` text DEFAULT 'always' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `facets_entry_idx` ON `facets` (`entry_id`);--> statement-breakpoint
CREATE TABLE `kinds` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `types` (
	`id` text PRIMARY KEY NOT NULL,
	`kind_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`kind_id`) REFERENCES `kinds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `types_kind_name_unique` ON `types` (`kind_id`,`name`);
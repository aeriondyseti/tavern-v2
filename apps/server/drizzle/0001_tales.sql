CREATE TABLE `anchor_facets` (
	`id` text PRIMARY KEY NOT NULL,
	`tale_id` text NOT NULL,
	`scene_id` text,
	`label` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tale_id`) REFERENCES `tales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `anchor_facets_tale_idx` ON `anchor_facets` (`tale_id`);--> statement-breakpoint
CREATE INDEX `anchor_facets_scene_idx` ON `anchor_facets` (`scene_id`);--> statement-breakpoint
CREATE TABLE `pinned` (
	`id` text PRIMARY KEY NOT NULL,
	`tale_id` text,
	`scene_id` text,
	`entry_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tale_id`) REFERENCES `tales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK (`tale_id` IS NOT NULL OR `scene_id` IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `pinned_tale_idx` ON `pinned` (`tale_id`);--> statement-breakpoint
CREATE INDEX `pinned_scene_idx` ON `pinned` (`scene_id`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`tale_id` text NOT NULL,
	`name` text NOT NULL,
	`anchor_prose` text DEFAULT '' NOT NULL,
	`adjustments_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tale_id`) REFERENCES `tales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjustments_id`) REFERENCES `setups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scenes_tale_idx` ON `scenes` (`tale_id`);--> statement-breakpoint
CREATE TABLE `setups` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tales` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`anchor_prose` text DEFAULT '' NOT NULL,
	`setup_id` text NOT NULL,
	`active_scene_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE no action ON DELETE no action
);

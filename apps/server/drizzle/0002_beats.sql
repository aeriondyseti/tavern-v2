CREATE TABLE `beat_transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`beat_id` text NOT NULL,
	`alt_index` integer DEFAULT -1 NOT NULL,
	`request_body` text,
	`events` text DEFAULT '[]' NOT NULL,
	`search_calls` text DEFAULT '[]' NOT NULL,
	`model` text NOT NULL,
	`duration_ms` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`beat_id`) REFERENCES `beats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `beat_transcripts_beat_idx` ON `beat_transcripts` (`beat_id`);--> statement-breakpoint
CREATE TABLE `beats` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`player_input` text NOT NULL,
	`narrator_output` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'streaming' NOT NULL,
	`alts` text DEFAULT '[]' NOT NULL,
	`active_alt` integer DEFAULT -1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `beats_scene_idx` ON `beats` (`scene_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pinned` (
	`id` text PRIMARY KEY NOT NULL,
	`tale_id` text,
	`scene_id` text,
	`entry_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tale_id`) REFERENCES `tales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "pinned_scope_check" CHECK("__new_pinned"."tale_id" IS NOT NULL OR "__new_pinned"."scene_id" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_pinned`("id", "tale_id", "scene_id", "entry_id", "position") SELECT "id", "tale_id", "scene_id", "entry_id", "position" FROM `pinned`;--> statement-breakpoint
DROP TABLE `pinned`;--> statement-breakpoint
ALTER TABLE `__new_pinned` RENAME TO `pinned`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `pinned_tale_idx` ON `pinned` (`tale_id`);--> statement-breakpoint
CREATE INDEX `pinned_scene_idx` ON `pinned` (`scene_id`);
CREATE TABLE `anchor_facets` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`scene_id` text,
	`label` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `anchor_facets_story_idx` ON `anchor_facets` (`story_id`);--> statement-breakpoint
CREATE INDEX `anchor_facets_scene_idx` ON `anchor_facets` (`scene_id`);--> statement-breakpoint
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
CREATE TABLE `cues` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`term` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cues_entry_idx` ON `cues` (`entry_id`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`type_id` text NOT NULL,
	`name` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`embedding_vec` blob,
	`embedding_model` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_type_name_unique` ON `entries` (`type_id`,`name`);--> statement-breakpoint
CREATE INDEX `entries_type_idx` ON `entries` (`type_id`);--> statement-breakpoint
CREATE TABLE `kinds` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pinned` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text,
	`scene_id` text,
	`entry_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "pinned_scope_check" CHECK("pinned"."story_id" IS NOT NULL OR "pinned"."scene_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `pinned_story_idx` ON `pinned` (`story_id`);--> statement-breakpoint
CREATE INDEX `pinned_scene_idx` ON `pinned` (`scene_id`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`anchor_prose` text DEFAULT '' NOT NULL,
	`adjustments_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjustments_id`) REFERENCES `setups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scenes_story_idx` ON `scenes` (`story_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`default_model` text DEFAULT 'claude-opus-4-7' NOT NULL,
	`default_temperature` real DEFAULT 1 NOT NULL,
	`default_max_tokens` integer DEFAULT 4096 NOT NULL,
	`default_thinking_budget` integer,
	`embedding_provider` text DEFAULT 'local' NOT NULL,
	`embedding_model_local` text DEFAULT 'Xenova/bge-small-en-v1.5' NOT NULL,
	`embedding_api_url` text,
	`embedding_api_key` text,
	`embedding_api_model` text
);
--> statement-breakpoint
CREATE TABLE `setups` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stories` (
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
-- entries FTS5 virtual table
-- (drizzle-kit doesn't generate this; appended manually)
CREATE VIRTUAL TABLE `entries_fts` USING fts5(
  entry_id UNINDEXED,
  name,
  cue_text,
  body_text,
  tokenize = 'porter unicode61'
);


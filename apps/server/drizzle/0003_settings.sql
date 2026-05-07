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

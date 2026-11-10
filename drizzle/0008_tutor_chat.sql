CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`parts` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_messages_conversation_idx` ON `chat_messages` (`owner_id`,`conversation_id`,`position`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`topic` text DEFAULT 'general' NOT NULL,
	`level` text DEFAULT 'basico' NOT NULL,
	`updated_at` integer NOT NULL
);

ALTER TYPE "public"."role" ADD VALUE 'master';--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_openId_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "permissions" SET DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "permissions" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "openId";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "loginMethod";
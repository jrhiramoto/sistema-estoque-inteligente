ALTER TABLE "users" ALTER COLUMN "openId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "loginMethod" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passwordHash" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
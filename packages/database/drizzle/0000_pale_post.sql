CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'pro', 'elite');--> statement-breakpoint
CREATE TYPE "public"."competition_tier" AS ENUM('tier1', 'tier2', 'tier3');--> statement-breakpoint
CREATE TYPE "public"."sport_slug" AS ENUM('football', 'tennis', 'darts', 'cricket', 'basketball', 'american_football', 'golf', 'boxing', 'mma', 'f1', 'horse_racing', 'rugby', 'ice_hockey', 'baseball', 'esports');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('scheduled', 'live', 'finished', 'cancelled', 'postponed');--> statement-breakpoint
CREATE TYPE "public"."market_type" AS ENUM('match_winner', 'double_chance', 'both_teams_score', 'over_under_goals', 'over_under_points', 'correct_score', 'first_scorer', 'handicap', 'set_winner', 'game_winner', 'frame_winner', 'to_qualify');--> statement-breakpoint
CREATE TYPE "public"."prediction_status" AS ENUM('pending', 'won', 'lost', 'void', 'cashout');--> statement-breakpoint
CREATE TYPE "public"."prediction_type" AS ENUM('single', 'accumulator');--> statement-breakpoint
CREATE TYPE "public"."currency_type" AS ENUM('coins', 'stars', 'gems');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('prediction_stake', 'prediction_win', 'prediction_refund', 'daily_topup', 'ad_bonus', 'achievement_reward', 'challenge_reward', 'leaderboard_reward', 'shop_purchase', 'gem_purchase', 'subscription_bonus', 'referral_bonus', 'streak_bonus', 'login_bonus', 'welcome_bonus');--> statement-breakpoint
CREATE TYPE "public"."achievement_category" AS ENUM('predictions', 'wins', 'streaks', 'sports', 'accumulators', 'social', 'collector', 'special');--> statement-breakpoint
CREATE TYPE "public"."achievement_tier" AS ENUM('bronze', 'silver', 'gold', 'platinum', 'diamond');--> statement-breakpoint
CREATE TYPE "public"."challenge_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."challenge_type" AS ENUM('win_predictions', 'place_predictions', 'win_accumulator', 'predict_sport', 'predict_live', 'win_streak', 'odds_range', 'specific_market');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('prediction_placed', 'prediction_won', 'accumulator_won', 'achievement_unlocked', 'challenge_completed', 'streak_milestone', 'leaderboard_rank', 'friend_joined');--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'completed', 'rewarded');--> statement-breakpoint
CREATE TYPE "public"."cosmetic_category" AS ENUM('avatar_frame', 'background', 'card_skin', 'victory_animation', 'username_color', 'emote', 'badge');--> statement-breakpoint
CREATE TYPE "public"."cosmetic_rarity" AS ENUM('common', 'uncommon', 'rare', 'epic', 'legendary');--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"notify_predictions" boolean DEFAULT true NOT NULL,
	"notify_challenges" boolean DEFAULT true NOT NULL,
	"notify_friends" boolean DEFAULT true NOT NULL,
	"notify_marketing" boolean DEFAULT false NOT NULL,
	"theme" varchar(20) DEFAULT 'dark' NOT NULL,
	"show_on_leaderboard" boolean DEFAULT true NOT NULL,
	"show_activity_to_friends" boolean DEFAULT true NOT NULL,
	"allow_friend_requests" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"total_predictions" integer DEFAULT 0 NOT NULL,
	"total_wins" integer DEFAULT 0 NOT NULL,
	"total_losses" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"total_stars_earned" integer DEFAULT 0 NOT NULL,
	"total_coins_wagered" integer DEFAULT 0 NOT NULL,
	"total_accumulators_won" integer DEFAULT 0 NOT NULL,
	"biggest_win" integer DEFAULT 0 NOT NULL,
	"last_topup_date" timestamp with time zone,
	"login_streak" integer DEFAULT 0 NOT NULL,
	"last_login_date" timestamp with time zone,
	"ads_watched_today" integer DEFAULT 0 NOT NULL,
	"has_prediction_boost" boolean DEFAULT false NOT NULL,
	"prediction_boost_expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cognito_id" varchar(128) NOT NULL,
	"username" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"coins" integer DEFAULT 1000 NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"gems" integer DEFAULT 0 NOT NULL,
	"subscription_tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"subscription_expires_at" timestamp with time zone,
	"is_ads_enabled" boolean DEFAULT true NOT NULL,
	"is_over_18" boolean DEFAULT true NOT NULL,
	"show_affiliates" boolean DEFAULT false NOT NULL,
	"avatar_url" varchar(512),
	"referral_code" varchar(20),
	"referred_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_cognito_id_unique" UNIQUE("cognito_id"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(50),
	"country" varchar(100),
	"logo_url" varchar(512),
	"tier" "competition_tier" DEFAULT 'tier2' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"external_flashscore_id" varchar(100),
	"external_oddschecker_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"nationality" varchar(100),
	"image_url" varchar(512),
	"sport_id" uuid NOT NULL,
	"ranking" integer,
	"external_flashscore_id" varchar(100),
	"external_oddschecker_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "sports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" "sport_slug" NOT NULL,
	"icon_name" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sports_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "team_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"alias" varchar(200) NOT NULL,
	"source" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_competitions" (
	"team_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(50),
	"logo_url" varchar(512),
	"external_flashscore_id" varchar(100),
	"external_oddschecker_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"competition_name" varchar(200),
	"home_team_id" uuid,
	"away_team_id" uuid,
	"home_team_name" varchar(200),
	"away_team_name" varchar(200),
	"player1_id" uuid,
	"player2_id" uuid,
	"player1_name" varchar(200),
	"player2_name" varchar(200),
	"start_time" timestamp with time zone NOT NULL,
	"status" "event_status" DEFAULT 'scheduled' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"period" varchar(50),
	"minute" integer,
	"is_featured" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"prediction_count" integer DEFAULT 0 NOT NULL,
	"external_flashscore_id" varchar(100),
	"external_oddschecker_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"type" "market_type" NOT NULL,
	"name" varchar(100),
	"line" numeric(5, 2),
	"is_suspended" boolean DEFAULT false NOT NULL,
	"is_main_market" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"odds" numeric(8, 2) NOT NULL,
	"previous_odds" numeric(8, 2),
	"is_winner" boolean,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsored_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"sponsor_name" varchar(100) NOT NULL,
	"sponsor_logo_url" varchar(512) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" varchar(500),
	"prize_description" varchar(500),
	"branding_color" varchar(20),
	"bonus_stars_multiplier" numeric(4, 2) DEFAULT '1.5' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	CONSTRAINT "sponsored_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "accumulator_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prediction_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"outcome_id" uuid NOT NULL,
	"odds" numeric(8, 2) NOT NULL,
	"status" "prediction_status" DEFAULT 'pending' NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "prediction_type" NOT NULL,
	"event_id" uuid,
	"market_id" uuid,
	"outcome_id" uuid,
	"stake" integer NOT NULL,
	"odds" numeric(8, 2) NOT NULL,
	"total_odds" numeric(10, 2) NOT NULL,
	"potential_coins" integer NOT NULL,
	"potential_stars" integer NOT NULL,
	"stars_multiplier" numeric(4, 2) DEFAULT '1.0' NOT NULL,
	"status" "prediction_status" DEFAULT 'pending' NOT NULL,
	"settled_coins" integer,
	"settled_stars" integer,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"currency" "currency_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" varchar(500) NOT NULL,
	"reference_id" uuid,
	"reference_type" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "achievement_category" NOT NULL,
	"tier" "achievement_tier" NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(500) NOT NULL,
	"icon_name" varchar(50) NOT NULL,
	"requirement_type" varchar(50) NOT NULL,
	"requirement_value" integer NOT NULL,
	"requirement_sport_slug" "sport_slug",
	"additional_criteria" jsonb,
	"reward_coins" integer DEFAULT 0 NOT NULL,
	"reward_stars" integer DEFAULT 0 NOT NULL,
	"reward_gems" integer DEFAULT 0 NOT NULL,
	"next_tier_id" uuid,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "challenge_type" NOT NULL,
	"difficulty" "challenge_difficulty" NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" varchar(500) NOT NULL,
	"icon_name" varchar(50) NOT NULL,
	"target_value" integer NOT NULL,
	"sport_slug" "sport_slug",
	"market_type" varchar(50),
	"min_odds" integer,
	"max_odds" integer,
	"require_live" boolean DEFAULT false,
	"require_accumulator" boolean DEFAULT false,
	"reward_coins" integer DEFAULT 0 NOT NULL,
	"reward_stars" integer DEFAULT 0 NOT NULL,
	"reward_gems" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"is_weekly" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"current_progress" integer DEFAULT 0 NOT NULL,
	"is_unlocked" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp with time zone,
	"is_claimed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_id" uuid NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"is_claimed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "activity_feed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "activity_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" varchar(500),
	"prediction_id" uuid,
	"achievement_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"referral_code" varchar(20) NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"referrer_reward_coins" integer DEFAULT 500 NOT NULL,
	"referrer_reward_stars" integer DEFAULT 100 NOT NULL,
	"referred_reward_coins" integer DEFAULT 1000 NOT NULL,
	"referred_reward_stars" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cosmetics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(500) NOT NULL,
	"category" "cosmetic_category" NOT NULL,
	"rarity" "cosmetic_rarity" DEFAULT 'common' NOT NULL,
	"price_stars" integer,
	"price_gems" integer,
	"price_usd" numeric(8, 2),
	"image_url" varchar(512),
	"animation_url" varchar(512),
	"icon_name" varchar(50),
	"color_value" varchar(20),
	"is_available" boolean DEFAULT true NOT NULL,
	"is_premium_only" boolean DEFAULT false NOT NULL,
	"is_limited_time" boolean DEFAULT false NOT NULL,
	"is_exclusive" boolean DEFAULT false NOT NULL,
	"limit_per_user" integer,
	"available_until" timestamp with time zone,
	"apple_product_id" varchar(100),
	"google_product_id" varchar(100),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gem_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"gems" integer NOT NULL,
	"bonus_percent" integer DEFAULT 0 NOT NULL,
	"price_gbp" numeric(8, 2) NOT NULL,
	"price_usd" numeric(8, 2) NOT NULL,
	"apple_product_id" varchar(100),
	"google_product_id" varchar(100),
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_best_value" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_cosmetics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cosmetic_id" uuid NOT NULL,
	"currency_used" varchar(20) NOT NULL,
	"price_paid" integer DEFAULT 0 NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_inventory" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"equipped_avatar_frame_id" uuid,
	"equipped_background_id" uuid,
	"equipped_card_skin_id" uuid,
	"equipped_badge_id" uuid,
	"equipped_victory_animation_id" uuid,
	"equipped_username_color_id" uuid,
	"streak_shields" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_aliases" ADD CONSTRAINT "team_aliases_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_competitions" ADD CONSTRAINT "team_competitions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_competitions" ADD CONSTRAINT "team_competitions_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_events" ADD CONSTRAINT "sponsored_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accumulator_selections" ADD CONSTRAINT "accumulator_selections_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accumulator_selections" ADD CONSTRAINT "accumulator_selections_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accumulator_selections" ADD CONSTRAINT "accumulator_selections_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accumulator_selections" ADD CONSTRAINT "accumulator_selections_outcome_id_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_outcome_id_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cosmetics" ADD CONSTRAINT "user_cosmetics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cosmetics" ADD CONSTRAINT "user_cosmetics_cosmetic_id_cosmetics_id_fk" FOREIGN KEY ("cosmetic_id") REFERENCES "public"."cosmetics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_equipped_avatar_frame_id_cosmetics_id_fk" FOREIGN KEY ("equipped_avatar_frame_id") REFERENCES "public"."cosmetics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_equipped_background_id_cosmetics_id_fk" FOREIGN KEY ("equipped_background_id") REFERENCES "public"."cosmetics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_equipped_card_skin_id_cosmetics_id_fk" FOREIGN KEY ("equipped_card_skin_id") REFERENCES "public"."cosmetics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_equipped_badge_id_cosmetics_id_fk" FOREIGN KEY ("equipped_badge_id") REFERENCES "public"."cosmetics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_equipped_victory_animation_id_cosmetics_id_fk" FOREIGN KEY ("equipped_victory_animation_id") REFERENCES "public"."cosmetics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_equipped_username_color_id_cosmetics_id_fk" FOREIGN KEY ("equipped_username_color_id") REFERENCES "public"."cosmetics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_stats_total_stars_idx" ON "user_stats" USING btree ("total_stars_earned");--> statement-breakpoint
CREATE INDEX "user_stats_current_streak_idx" ON "user_stats" USING btree ("current_streak");--> statement-breakpoint
CREATE INDEX "users_cognito_id_idx" ON "users" USING btree ("cognito_id");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_referral_code_idx" ON "users" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "competitions_sport_id_idx" ON "competitions" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "competitions_external_flashscore_idx" ON "competitions" USING btree ("external_flashscore_id");--> statement-breakpoint
CREATE INDEX "players_sport_id_idx" ON "players" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "players_name_idx" ON "players" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "sports_slug_idx" ON "sports" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sports_active_idx" ON "sports" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "team_aliases_team_id_idx" ON "team_aliases" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_aliases_alias_source_idx" ON "team_aliases" USING btree ("alias","source");--> statement-breakpoint
CREATE INDEX "team_competitions_team_idx" ON "team_competitions" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_competitions_competition_idx" ON "team_competitions" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "teams_name_idx" ON "teams" USING btree ("name");--> statement-breakpoint
CREATE INDEX "teams_external_flashscore_idx" ON "teams" USING btree ("external_flashscore_id");--> statement-breakpoint
CREATE INDEX "events_sport_id_idx" ON "events" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "events_competition_id_idx" ON "events" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "events_start_time_idx" ON "events" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_status_start_time_idx" ON "events" USING btree ("status","start_time");--> statement-breakpoint
CREATE INDEX "events_featured_idx" ON "events" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "events_external_flashscore_idx" ON "events" USING btree ("external_flashscore_id");--> statement-breakpoint
CREATE INDEX "markets_event_id_idx" ON "markets" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "markets_event_type_idx" ON "markets" USING btree ("event_id","type");--> statement-breakpoint
CREATE INDEX "outcomes_market_id_idx" ON "outcomes" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "sponsored_events_event_id_idx" ON "sponsored_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "accumulator_selections_prediction_id_idx" ON "accumulator_selections" USING btree ("prediction_id");--> statement-breakpoint
CREATE INDEX "accumulator_selections_event_id_idx" ON "accumulator_selections" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "predictions_user_id_idx" ON "predictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "predictions_user_status_idx" ON "predictions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "predictions_event_id_idx" ON "predictions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "predictions_status_idx" ON "predictions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "predictions_created_at_idx" ON "predictions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_user_id_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_user_created_at_idx" ON "transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_reference_idx" ON "transactions" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "achievements_category_idx" ON "achievements" USING btree ("category");--> statement-breakpoint
CREATE INDEX "achievements_tier_idx" ON "achievements" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "challenges_expires_at_idx" ON "challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "challenges_weekly_idx" ON "challenges" USING btree ("is_weekly");--> statement-breakpoint
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_achievements_user_unlocked_idx" ON "user_achievements" USING btree ("user_id","is_unlocked");--> statement-breakpoint
CREATE INDEX "user_challenges_user_id_idx" ON "user_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_challenges_user_completed_idx" ON "user_challenges" USING btree ("user_id","is_completed");--> statement-breakpoint
CREATE INDEX "activity_feed_user_id_idx" ON "activity_feed" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_feed_created_at_idx" ON "activity_feed" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_feed_user_created_at_idx" ON "activity_feed" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "friendships_requester_id_idx" ON "friendships" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "friendships_addressee_id_idx" ON "friendships" USING btree ("addressee_id");--> statement-breakpoint
CREATE INDEX "friendships_status_idx" ON "friendships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "referrals_referrer_id_idx" ON "referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "referrals_referred_user_id_idx" ON "referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "referrals_referral_code_idx" ON "referrals" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "referrals_status_idx" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cosmetics_category_idx" ON "cosmetics" USING btree ("category");--> statement-breakpoint
CREATE INDEX "cosmetics_available_idx" ON "cosmetics" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "cosmetics_rarity_idx" ON "cosmetics" USING btree ("rarity");--> statement-breakpoint
CREATE INDEX "user_cosmetics_user_id_idx" ON "user_cosmetics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_cosmetics_cosmetic_id_idx" ON "user_cosmetics" USING btree ("cosmetic_id");
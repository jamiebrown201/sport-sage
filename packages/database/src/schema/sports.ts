import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const sportSlugEnum = pgEnum('sport_slug', [
  'football',
  'tennis',
  'darts',
  'cricket',
  'basketball',
  'american_football',
  'golf',
  'boxing',
  'mma',
  'f1',
  'horse_racing',
  'rugby',
  'ice_hockey',
  'baseball',
  'esports',
]);

export const competitionTierEnum = pgEnum('competition_tier', ['tier1', 'tier2', 'tier3']);

// Sports table
export const sports = pgTable(
  'sports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: sportSlugEnum('slug').unique().notNull(),
    iconName: varchar('icon_name', { length: 50 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('sports_slug_idx').on(table.slug),
    index('sports_active_idx').on(table.isActive),
  ]
);

// Competitions table
export const competitions = pgTable(
  'competitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sportId: uuid('sport_id')
      .notNull()
      .references(() => sports.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    shortName: varchar('short_name', { length: 50 }),
    country: varchar('country', { length: 100 }),
    logoUrl: varchar('logo_url', { length: 512 }),
    tier: competitionTierEnum('tier').notNull().default('tier2'),
    isActive: boolean('is_active').notNull().default(true),
    externalFlashscoreId: varchar('external_flashscore_id', { length: 100 }),
    externalOddscheckerId: varchar('external_oddschecker_id', { length: 100 }),
  },
  (table) => [
    index('competitions_sport_id_idx').on(table.sportId),
    index('competitions_external_flashscore_idx').on(table.externalFlashscoreId),
  ]
);

// Teams table
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    shortName: varchar('short_name', { length: 50 }),
    logoUrl: varchar('logo_url', { length: 512 }),
    externalFlashscoreId: varchar('external_flashscore_id', { length: 100 }),
    externalOddscheckerId: varchar('external_oddschecker_id', { length: 100 }),
  },
  (table) => [
    index('teams_name_idx').on(table.name),
    index('teams_external_flashscore_idx').on(table.externalFlashscoreId),
  ]
);

// Team name aliases for normalization across sources
export const teamAliases = pgTable(
  'team_aliases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    alias: varchar('alias', { length: 200 }).notNull(),
    source: varchar('source', { length: 50 }).notNull(), // 'flashscore', 'oddschecker', 'manual'
  },
  (table) => [
    index('team_aliases_team_id_idx').on(table.teamId),
    index('team_aliases_alias_source_idx').on(table.alias, table.source),
  ]
);

// Junction table for teams in competitions
export const teamCompetitions = pgTable(
  'team_competitions',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('team_competitions_team_idx').on(table.teamId),
    index('team_competitions_competition_idx').on(table.competitionId),
  ]
);

// Players table (for individual sports)
export const players = pgTable(
  'players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    nationality: varchar('nationality', { length: 100 }),
    imageUrl: varchar('image_url', { length: 512 }),
    sportId: uuid('sport_id')
      .notNull()
      .references(() => sports.id, { onDelete: 'cascade' }),
    ranking: integer('ranking'),
    externalFlashscoreId: varchar('external_flashscore_id', { length: 100 }),
    externalOddscheckerId: varchar('external_oddschecker_id', { length: 100 }),
  },
  (table) => [
    index('players_sport_id_idx').on(table.sportId),
    index('players_name_idx').on(table.name),
  ]
);

// Relations
export const sportsRelations = relations(sports, ({ many }) => ({
  competitions: many(competitions),
  players: many(players),
}));

export const competitionsRelations = relations(competitions, ({ one, many }) => ({
  sport: one(sports, {
    fields: [competitions.sportId],
    references: [sports.id],
  }),
  teamCompetitions: many(teamCompetitions),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  aliases: many(teamAliases),
  teamCompetitions: many(teamCompetitions),
}));

export const teamAliasesRelations = relations(teamAliases, ({ one }) => ({
  team: one(teams, {
    fields: [teamAliases.teamId],
    references: [teams.id],
  }),
}));

export const teamCompetitionsRelations = relations(teamCompetitions, ({ one }) => ({
  team: one(teams, {
    fields: [teamCompetitions.teamId],
    references: [teams.id],
  }),
  competition: one(competitions, {
    fields: [teamCompetitions.competitionId],
    references: [competitions.id],
  }),
}));

export const playersRelations = relations(players, ({ one }) => ({
  sport: one(sports, {
    fields: [players.sportId],
    references: [sports.id],
  }),
}));

// Type exports
export type Sport = typeof sports.$inferSelect;
export type NewSport = typeof sports.$inferInsert;
export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamAlias = typeof teamAliases.$inferSelect;
export type NewTeamAlias = typeof teamAliases.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;

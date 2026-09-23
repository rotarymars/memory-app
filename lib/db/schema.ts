import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const cards = pgTable(
  "cards",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    front: text("front").notNull(),
    back: text("back").notNull(),
    frontImageUrl: text("front_image_url"),
    backImageUrl: text("back_image_url"),
    tag: text("tag"),
    reviewLevel: integer("review_level").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    // Lifetime tally of review answers, one column per outcome. Kept as
    // counters on the card rather than a per-review log so storage stays flat
    // no matter how much you review; the progress page aggregates these.
    againCount: integer("again_count").notNull().default(0),
    downCount: integer("down_count").notNull().default(0),
    goodCount: integer("good_count").notNull().default(0),
    greatCount: integer("great_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("cards_user_id_idx").on(table.userId)]
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPreview: text("token_preview").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [index("api_tokens_user_id_idx").on(table.userId)]
);

export type ApiToken = typeof apiTokens.$inferSelect;

// Accounts are created with `npm run user:create` — there is no sign-up page.
// `id` is text so accounts migrated from Clerk keep their old `user_…` ids and
// the cards/api_tokens rows that reference them stay attached.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the token in the session cookie; the raw token is never stored.
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

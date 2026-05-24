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

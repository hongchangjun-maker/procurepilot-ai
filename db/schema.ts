import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const agencies = sqliteTable("agencies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  regionSido: text("region_sido").notNull().default("전국"),
  regionSigungu: text("region_sigungu").notNull().default(""),
  homepageUrl: text("homepage_url").notNull().default(""),
  sourceType: text("source_type").notNull().default("api"),
  sourceConfig: text("source_config").notNull().default("{}"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const opportunities = sqliteTable("opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceName: text("source_name").notNull(),
  sourceNoticeId: text("source_notice_id").notNull(),
  title: text("title").notNull(),
  agencyName: text("agency_name").notNull(),
  regionSido: text("region_sido").notNull().default("전국"),
  regionSigungu: text("region_sigungu").notNull().default(""),
  category: text("category").notNull().default("기타"),
  noticeType: text("notice_type").notNull().default("입찰공고"),
  publishedAt: text("published_at").notNull(),
  deadlineAt: text("deadline_at").notNull().default(""),
  budget: integer("budget").notNull().default(0),
  summaryRaw: text("summary_raw").notNull().default(""),
  detailText: text("detail_text").notNull().default(""),
  originalUrl: text("original_url").notNull(),
  status: text("status").notNull().default("진행중"),
  duplicateKey: text("duplicate_key").notNull(),
  version: integer("version").notNull().default(1),
  ...timestamps,
}, (table) => [
  uniqueIndex("opportunities_duplicate_key_idx").on(table.duplicateKey),
  index("opportunities_deadline_idx").on(table.deadlineAt),
  index("opportunities_agency_idx").on(table.agencyName),
]);

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opportunityId: integer("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull().default(""),
  fileSize: integer("file_size").notNull().default(0),
  extractedText: text("extracted_text").notNull().default(""),
  storageKey: text("storage_key").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const aiAnalyses = sqliteTable("ai_analyses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opportunityId: integer("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  summaryJson: text("summary_json").notNull(),
  relevanceScore: real("relevance_score").notNull().default(0),
  relevanceGrade: text("relevance_grade").notNull().default(""),
  relevanceReason: text("relevance_reason").notNull().default(""),
  strengths: text("strengths").notNull().default("[]"),
  weaknesses: text("weaknesses").notNull().default("[]"),
  strategy: text("strategy").notNull().default(""),
  modelName: text("model_name").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("ai_analyses_opportunity_idx").on(table.opportunityId)]);

export const businessProfiles = sqliteTable("business_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyName: text("company_name").notNull(),
  intro: text("intro").notNull().default(""),
  technologies: text("technologies").notNull().default(""),
  services: text("services").notNull().default(""),
  achievements: text("achievements").notNull().default(""),
  strengths: text("strengths").notNull().default(""),
  targetMarkets: text("target_markets").notNull().default(""),
  preferredCategories: text("preferred_categories").notNull().default(""),
  excludedCategories: text("excluded_categories").notNull().default(""),
  budgetRange: text("budget_range").notNull().default(""),
  serviceRegions: text("service_regions").notNull().default(""),
  ...timestamps,
});

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const collectionLogs = sqliteTable("collection_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceName: text("source_name").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at").notNull().default(""),
  status: text("status").notNull(),
  totalCount: integer("total_count").notNull().default(0),
  newCount: integer("new_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  errorMessage: text("error_message").notNull().default(""),
});

export const userNotes = sqliteTable("user_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opportunityId: integer("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  note: text("note").notNull().default(""),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  tags: text("tags").notNull().default(""),
  ...timestamps,
}, (table) => [uniqueIndex("user_notes_opportunity_idx").on(table.opportunityId)]);

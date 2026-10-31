import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  numeric,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────
// AGENTS — the AI crew (Prospector, Validator, Emailor, Mapper,
// Coder, Deployer, Saler, Paymer, Domainner, Support)
// ─────────────────────────────────────────────
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // 'prospector' | 'validator' | ...
  name: text("name").notNull(),
  roleTitle: text("role_title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  status: text("status").notNull().default("ready"), // ready | running | paused | error
  isLive: boolean("is_live").notNull().default(false), // has real credentials
  autoPilot: boolean("auto_pilot").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  stats: jsonb("stats").$type<{ runs: number; successes: number; failures: number }>().notNull().default({ runs: 0, successes: 0, failures: 0 }),
  lastRunAt: timestamp("last_run_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// PROSPECTS — leads flowing through the pipeline
// stage: discovered → validated → email_verified → mapped
//        → site_built → deployed → contacted → paid → domain_linked
//        (or rejected)
// ─────────────────────────────────────────────
export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(),
  businessName: text("business_name").notNull(),
  businessType: text("business_type").notNull().default("business"),
  tagline: text("tagline"),
  description: text("description"),
  phone: text("phone"),
  email: text("email"),
  emailStatus: text("email_status").notNull().default("unknown"), // unknown | valid | risky | invalid
  emailDetail: text("email_detail"),
  address: text("address"),
  city: text("city"),
  zip: text("zip"),
  country: text("country"),
  rating: numeric("rating"),
  reviewCount: integer("review_count"),
  hasWebsite: boolean("has_website").notNull().default(false),
  websiteUrl: text("website_url"),
  mapsLink: text("maps_link"),
  lat: numeric("lat"),
  lng: numeric("lng"),
  hours: jsonb("hours").$type<Record<string, string>>(),
  source: text("source").notNull().default("simulation"), // serper | simulation
  stage: text("stage").notNull().default("discovered"),
  rejectReason: text("reject_reason"),
  clientData: jsonb("client_data").$type<Record<string, string>>(), // Mapper sheet
  siteHtml: text("site_html"),
  siteSlug: text("site_slug"),
  deployedUrl: text("deployed_url"),
  deployStatus: text("deploy_status").notNull().default("none"), // none | live | simulated | error
  salesEmailId: text("sales_email_id"),
  contactedAt: timestamp("contacted_at"),
  paymentUrl: text("payment_url"),
  paymentStatus: text("payment_status").notNull().default("none"), // none | pending | paid | simulated
  domainUrl: text("domain_url"),
  searchQuery: text("search_query"), // niche + city that found this lead
  aiScore: integer("ai_score"), // potentiel commercial évalué par le cerveau IA
  aiInsight: text("ai_insight"), // analyse de l'agent sur ce lead
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// ACTIVITIES — live ops feed (every agent action is logged)
// ─────────────────────────────────────────────
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  agentKey: text("agent_key").notNull(),
  action: text("action").notNull(),
  message: text("message").notNull(),
  level: text("level").notNull().default("info"), // info | success | warn | error
  prospectId: integer("prospect_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// SETTINGS — encrypted-at-rest-by-env style key/value store
// (Telegram, Brevo, Vercel, Whop, LLM omniroute, Serper defaults)
// ─────────────────────────────────────────────
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// SERPER KEYS — rotation of Serper.dev accounts (2500 free credits each)
// When a key hits its quota the agent auto-provisions a replacement.
// ─────────────────────────────────────────────
export const serperKeys = pgTable("serper_keys", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  apiKey: text("api_key").notNull().unique(),
  creditLimit: integer("credit_limit").notNull().default(2500),
  creditsUsed: integer("credits_used").notNull().default(0),
  status: text("status").notNull().default("active"), // active | exhausted | error
  isProvisioned: boolean("is_provisioned").notNull().default(false), // auto-created by Prospector
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// SCOUT SCHEDULES — missions de prospection récurrentes (auto-pilote 24/7)
// ─────────────────────────────────────────────
export const scoutSchedules = pgTable("scout_schedules", {
  id: serial("id").primaryKey(),
  niche: text("niche").notNull(),
  city: text("city").notNull(),
  intervalHours: integer("interval_hours").notNull().default(6),
  maxResults: integer("max_results").notNull().default(12),
  active: boolean("active").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// AGENT SKILLS — compétences injectées dans le cerveau LLM d'un agent.
// Source: 'core' (livrée), 'user' (ajoutée par RIO), 'learned' (auto-générée).
// ─────────────────────────────────────────────
export const agentSkills = pgTable("agent_skills", {
  id: serial("id").primaryKey(),
  agentKey: text("agent_key").notNull(),
  title: text("title").notNull(),
  instruction: text("instruction").notNull(),
  source: text("source").notNull().default("user"), // core | user | learned
  active: boolean("active").notNull().default(true),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// AGENT LEARNINGS — mémoire d'auto-amélioration : ce que l'agent a compris
// de ses succès et de ses échecs, réinjecté dans ses prompts suivants.
// ─────────────────────────────────────────────
export const agentLearnings = pgTable("agent_learnings", {
  id: serial("id").primaryKey(),
  agentKey: text("agent_key").notNull(),
  insight: text("insight").notNull(),
  kind: text("kind").notNull().default("observation"), // observation | fix | strategy
  confidence: integer("confidence").notNull().default(60),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// AI CALLS — journal d'utilisation du LLM par agent (coût, latence, succès)
// ─────────────────────────────────────────────
export const aiCalls = pgTable("ai_calls", {
  id: serial("id").primaryKey(),
  agentKey: text("agent_key").notNull(),
  task: text("task").notNull(),
  ok: boolean("ok").notNull().default(true),
  latencyMs: integer("latency_ms").notNull().default(0),
  tokens: integer("tokens").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// RIO MESSAGES — mémoire de conversation du CEO IA (web + telegram)
// ─────────────────────────────────────────────
export const rioMessages = pgTable("rio_messages", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull().default("web"), // web | telegram
  role: text("role").notNull(), // user | assistant | tool
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls").$type<{ name: string; args: Record<string, unknown>; result?: string }[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// OBJECTIVES — les objectifs fixés par RIO (suivis par l'auto-pilote)
// ─────────────────────────────────────────────
export const objectives = pgTable("objectives", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  metric: text("metric").notNull().default("paid"), // leads | qualified | deployed | contacted | paid
  target: integer("target").notNull().default(10),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("active"), // active | done | archived
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// LEAD NOTES — notes internes / historique humain sur un lead
// ─────────────────────────────────────────────
export const leadNotes = pgTable("lead_notes", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").notNull(),
  author: text("author").notNull().default("RIO"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Agent = typeof agents.$inferSelect;
export type RioMessage = typeof rioMessages.$inferSelect;
export type Objective = typeof objectives.$inferSelect;
export type Prospect = typeof prospects.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type SerperKey = typeof serperKeys.$inferSelect;

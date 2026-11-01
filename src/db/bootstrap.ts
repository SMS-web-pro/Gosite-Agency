// Auto-migration idempotente — garantit que le schéma existe sur n'importe
// quelle base PostgreSQL (Neon, Supabase, Vercel Postgres, local) sans
// exécuter drizzle-kit push manuellement. Exécuté une fois par cold start.

import { execDdl } from "./index";

const DDL = `
CREATE TABLE IF NOT EXISTS agents (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  role_title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  is_live boolean NOT NULL DEFAULT false,
  auto_pilot boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  stats jsonb NOT NULL DEFAULT '{"runs":0,"successes":0,"failures":0}'::jsonb,
  last_run_at timestamp,
  last_error text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS prospects (
  id serial PRIMARY KEY,
  business_name text NOT NULL,
  business_type text NOT NULL DEFAULT 'business',
  tagline text,
  description text,
  phone text,
  email text,
  email_status text NOT NULL DEFAULT 'unknown',
  email_detail text,
  address text,
  city text,
  zip text,
  country text,
  rating numeric,
  review_count integer,
  has_website boolean NOT NULL DEFAULT false,
  website_url text,
  maps_link text,
  lat numeric,
  lng numeric,
  hours jsonb,
  source text NOT NULL DEFAULT 'simulation',
  stage text NOT NULL DEFAULT 'discovered',
  reject_reason text,
  client_data jsonb,
  site_html text,
  site_slug text,
  deployed_url text,
  deploy_status text NOT NULL DEFAULT 'none',
  sales_email_id text,
  contacted_at timestamp,
  payment_url text,
  payment_status text NOT NULL DEFAULT 'none',
  domain_url text,
  search_query text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS activities (
  id serial PRIMARY KEY,
  agent_key text NOT NULL,
  action text NOT NULL,
  message text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  prospect_id integer,
  meta jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS serper_keys (
  id serial PRIMARY KEY,
  label text NOT NULL,
  api_key text NOT NULL UNIQUE,
  credit_limit integer NOT NULL DEFAULT 2500,
  credits_used integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  is_provisioned boolean NOT NULL DEFAULT false,
  last_used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scout_schedules (
  id serial PRIMARY KEY,
  niche text NOT NULL,
  city text NOT NULL,
  interval_hours integer NOT NULL DEFAULT 6,
  max_results integer NOT NULL DEFAULT 12,
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rio_messages (
  id serial PRIMARY KEY,
  channel text NOT NULL DEFAULT 'web',
  role text NOT NULL,
  content text NOT NULL,
  tool_calls jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS objectives (
  id serial PRIMARY KEY,
  title text NOT NULL,
  metric text NOT NULL DEFAULT 'paid',
  target integer NOT NULL DEFAULT 10,
  due_date timestamp,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lead_notes (
  id serial PRIMARY KEY,
  prospect_id integer NOT NULL,
  author text NOT NULL DEFAULT 'RIO',
  body text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_skills (
  id serial PRIMARY KEY,
  agent_key text NOT NULL,
  title text NOT NULL,
  instruction text NOT NULL,
  source text NOT NULL DEFAULT 'user',
  active boolean NOT NULL DEFAULT true,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_learnings (
  id serial PRIMARY KEY,
  agent_key text NOT NULL,
  insight text NOT NULL,
  kind text NOT NULL DEFAULT 'observation',
  confidence integer NOT NULL DEFAULT 60,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_calls (
  id serial PRIMARY KEY,
  agent_key text NOT NULL,
  task text NOT NULL,
  ok boolean NOT NULL DEFAULT true,
  latency_ms integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ai_score integer;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ai_insight text;
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills (agent_key);
CREATE INDEX IF NOT EXISTS idx_agent_learnings_agent ON agent_learnings (agent_key);
CREATE INDEX IF NOT EXISTS idx_ai_calls_agent ON ai_calls (agent_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_stage ON prospects (stage);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rio_messages_created ON rio_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_notes_prospect ON lead_notes (prospect_id);
`;

let ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = execDdl(DDL).then(
      () => undefined,
      (err: unknown) => {
        ready = null;
        console.error("[db bootstrap]", err instanceof Error ? err.message : err);
        throw err;
      },
    );
  }
  return ready;
}

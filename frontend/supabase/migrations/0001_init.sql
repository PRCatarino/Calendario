-- Calendario schema for Supabase (Postgres). Run in Supabase SQL editor or via CLI.

create table if not exists accounts (
  id            bigint generated always as identity primary key,
  username      varchar(100) not null unique,
  password_hash varchar(200) not null,
  role          varchar(20)  not null check (role in ('ADMIN', 'CLIENT')),
  name          varchar(200) not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists meetings (
  id                bigint generated always as identity primary key,
  client_id         bigint references accounts(id),
  client_name       varchar(200),
  title             varchar(300),
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  notes             text,
  cover_url         varchar(1000),
  cover_type        varchar(10) default 'image',
  cover_frame_path  text,                 -- Supabase Storage path of the captured cover frame
  status            varchar(20) not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  reject_reason     varchar(1000),
  status_changed_by bigint,
  status_changed_at timestamptz,
  google_event_id   varchar(200),
  created_at        timestamptz not null default now()
);
create index if not exists idx_meetings_starts on meetings (starts_at);
create index if not exists idx_meetings_client on meetings (client_id);

-- single-row Google OAuth token store
create table if not exists google_tokens (
  id            int primary key default 1 check (id = 1),
  access_token  varchar(2000),
  refresh_token varchar(2000),
  expiry        bigint
);

-- write-only credentials vault: the app only INSERTs here, never SELECTs.
create table if not exists client_credentials (
  id         bigint generated always as identity primary key,
  name       varchar(200),
  username   varchar(100),
  password   varchar(200),
  created_at timestamptz not null default now()
);

-- Storage bucket for cover frames is created by the app on boot (see lib/server/supabase.ts),
-- or manually: Storage -> New bucket -> name "covers" (private).

-- Per-account Google connections (admin AND each client) + per-account event mapping.

create table if not exists google_connections (
  account_id    bigint primary key references accounts(id) on delete cascade,
  access_token  varchar(2000),
  refresh_token varchar(2000),
  expiry        bigint
);

-- migrate the existing single admin token into the per-account table
insert into google_connections (account_id, access_token, refresh_token, expiry)
select a.id, t.access_token, t.refresh_token, t.expiry
from google_tokens t
join accounts a on a.role = 'ADMIN'
where t.id = 1
on conflict (account_id) do nothing;

-- which Google event id belongs to which (meeting, account) pair
create table if not exists meeting_google_events (
  meeting_id bigint references meetings(id) on delete cascade,
  account_id bigint references accounts(id) on delete cascade,
  event_id   varchar(200),
  primary key (meeting_id, account_id)
);

-- backfill admin events from meetings.google_event_id
insert into meeting_google_events (meeting_id, account_id, event_id)
select m.id, a.id, m.google_event_id
from meetings m
join accounts a on a.role = 'ADMIN'
where m.google_event_id is not null
on conflict (meeting_id, account_id) do nothing;

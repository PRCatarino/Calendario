-- Profiles (avatar/email/phone) + client meeting attachments.

alter table accounts add column if not exists avatar_path text;
alter table accounts add column if not exists email varchar(200);
alter table accounts add column if not exists phone varchar(50);

create table if not exists meeting_attachments (
  id          bigint generated always as identity primary key,
  meeting_id  bigint not null references meetings(id) on delete cascade,
  path        text not null,
  media_type  varchar(10) not null check (media_type in ('image','video')),
  mime        varchar(100),
  size_bytes  bigint,
  uploaded_by bigint,
  created_at  timestamptz not null default now()
);
create index if not exists idx_attachments_meeting on meeting_attachments (meeting_id);

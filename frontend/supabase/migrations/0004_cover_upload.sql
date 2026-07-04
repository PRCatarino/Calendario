-- Admin can upload a cover file (jpeg/mp4) instead of a Drive link.
alter table meetings add column if not exists cover_storage_path text;

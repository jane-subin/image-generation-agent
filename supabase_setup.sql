create extension if not exists pgcrypto;

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  image_url text not null,
  sections jsonb not null default '[]'::jsonb,
  score smallint
);

create table if not exists section_examples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  generation_id uuid references generations(id) on delete cascade,
  category text not null,
  text text not null,
  score smallint not null
);

create index if not exists section_examples_category_score_idx
  on section_examples (category, score desc, created_at desc);

-- Added for soft-delete (sidebar Trash section)
alter table generations add column if not exists deleted_at timestamptz;

-- Added to store the actual (possibly user-edited) final prompt text,
-- instead of only the per-category sections breakdown.
alter table generations add column if not exists prompt text;

create table if not exists public.compatibility_ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

alter table public.compatibility_ai_usage enable row level security;

drop policy if exists "Users can read their compatibility AI usage" on public.compatibility_ai_usage;
create policy "Users can read their compatibility AI usage"
on public.compatibility_ai_usage
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can update their compatibility AI usage" on public.compatibility_ai_usage;
create policy "Users can update their compatibility AI usage"
on public.compatibility_ai_usage
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

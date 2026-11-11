-- Rays Connect: notification setup
-- Run this once in Supabase SQL Editor. Safe to re-run.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  message text not null default 'interacted with you.',
  type text not null default 'activity',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists recipient_id uuid,
  add column if not exists actor_id uuid,
  add column if not exists message text default 'interacted with you.',
  add column if not exists type text default 'activity',
  add column if not exists is_read boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications'
      and policyname = 'Users can read their own notifications'
  ) then
    create policy "Users can read their own notifications"
      on public.notifications for select
      to authenticated
      using (recipient_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications'
      and policyname = 'Users can mark their own notifications read'
  ) then
    create policy "Users can mark their own notifications read"
      on public.notifications for update
      to authenticated
      using (recipient_id = auth.uid())
      with check (recipient_id = auth.uid());
  end if;
end
$$;

create or replace function public.rays_notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner
  from public.posts
  where id = new.post_id;

  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, message, type)
    values (post_owner, new.user_id, 'liked your post.', 'like');
  end if;

  return new;
end;
$$;

create or replace function public.rays_notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
  parent_owner uuid;
begin
  select user_id into post_owner
  from public.posts
  where id = new.post_id;

  if new.parent_comment_id is not null then
    select user_id into parent_owner
    from public.comments
    where id = new.parent_comment_id;

    if parent_owner is not null and parent_owner <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, message, type)
      values (parent_owner, new.user_id, 'replied to your comment.', 'reply');
    end if;
  end if;

  if post_owner is not null
     and post_owner <> new.user_id
     and post_owner is distinct from parent_owner then
    insert into public.notifications (recipient_id, actor_id, message, type)
    values (
      post_owner,
      new.user_id,
      case when new.parent_comment_id is null
        then 'commented on your post.'
        else 'commented on your post.'
      end,
      'comment'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists rays_notify_post_like_trigger on public.likes;
create trigger rays_notify_post_like_trigger
after insert on public.likes
for each row execute function public.rays_notify_post_like();

drop trigger if exists rays_notify_comment_trigger on public.comments;
create trigger rays_notify_comment_trigger
after insert on public.comments
for each row execute function public.rays_notify_comment();

-- Enable live notification updates when Supabase Realtime is available.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end
$$;

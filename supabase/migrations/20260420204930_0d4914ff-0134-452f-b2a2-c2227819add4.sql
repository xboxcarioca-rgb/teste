create type public.app_role as enum ('admin', 'customer');
create type public.billing_period as enum ('monthly', 'annual');
create type public.subscription_status as enum ('pending', 'active', 'past_due', 'canceled', 'expired');
create type public.session_status as enum ('active', 'revoked', 'expired');
create type public.halftone_mode as enum ('circular', 'rosette_cmyk');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  status text not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  billing_period public.billing_period not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL',
  support_group_included boolean not null default false,
  prompt_library_included boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  status public.subscription_status not null default 'pending',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.access_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_token_hash text not null,
  device_label text,
  device_fingerprint text,
  user_agent text,
  ip_address inet,
  status public.session_status not null default 'active',
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.asset_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_filename text,
  output_filename text,
  halftone_mode public.halftone_mode not null,
  processing_ms integer,
  downloaded_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_profiles_user_id on public.profiles(user_id);
create index idx_user_roles_user_id on public.user_roles(user_id);
create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_status on public.subscriptions(status);
create index idx_access_sessions_user_id on public.access_sessions(user_id);
create index idx_access_sessions_status on public.access_sessions(status);
create index idx_audit_logs_user_id on public.audit_logs(user_id);
create index idx_audit_logs_event_type on public.audit_logs(event_type);
create index idx_asset_downloads_user_id on public.asset_downloads(user_id);
create index idx_asset_downloads_created_at on public.asset_downloads(created_at desc);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.access_sessions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.asset_downloads enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer');

  return new;
end;
$$;

create trigger update_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

create trigger update_plans_updated_at
before update on public.plans
for each row execute function public.update_updated_at_column();

create trigger update_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.update_updated_at_column();

create trigger update_access_sessions_updated_at
before update on public.access_sessions
for each row execute function public.update_updated_at_column();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Admins can view roles"
on public.user_roles
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles"
on public.user_roles
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Authenticated users can view active plans"
on public.plans
for select
to authenticated
using (active = true or public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage plans"
on public.plans
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Users can view their own subscriptions"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage subscriptions"
on public.subscriptions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Users can view their own sessions"
on public.access_sessions
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Users can create their own sessions"
on public.access_sessions
for insert
to authenticated
with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Users can update their own sessions"
on public.access_sessions
for update
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Admins can view audit logs"
on public.audit_logs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "System can insert audit logs"
on public.audit_logs
for insert
to authenticated
with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Users can view their own downloads"
on public.asset_downloads
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Users can create their own downloads"
on public.asset_downloads
for insert
to authenticated
with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Admins can update downloads"
on public.asset_downloads
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into public.plans (code, name, billing_period, price_cents, currency, support_group_included, prompt_library_included)
values
  ('mensal', 'Plano Mensal', 'monthly', 4700, 'BRL', false, true),
  ('anual', 'Plano Anual', 'annual', 16890, 'BRL', true, true);
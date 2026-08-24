-- MULTIVENT initial Supabase schema
-- Starter tables and columns only. Extend constraints, policies, triggers,
-- storage buckets, and indexes as the app requirements become final.

create extension if not exists "pgcrypto";

create type public.user_role as enum (
  'client',
  'service_provider',
  'event_coordinator',
  'admin',
  'superadmin'
);

create type public.account_status as enum (
  'pending',
  'active',
  'verified',
  'suspended',
  'disabled'
);

create type public.event_status as enum (
  'draft',
  'planning',
  'booking',
  'payment_required',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.booking_status as enum (
  'requested',
  'approved',
  'rejected',
  'payment_required',
  'paid',
  'confirmed',
  'completed',
  'cancelled',
  'expired'
);

create type public.payment_status as enum (
  'pending',
  'processing',
  'paid',
  'verified',
  'failed',
  'refunded',
  'cancelled'
);

create type public.notification_status as enum (
  'unread',
  'read',
  'archived'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  default_role public.user_role not null default 'client',
  account_status public.account_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name public.user_role not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_name text not null,
  description text,
  contact_email text,
  contact_phone text,
  location text,
  verification_status public.account_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  icon_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  category_id uuid references public.service_categories(id),
  name text not null,
  description text,
  base_price numeric(12,2),
  location text,
  cover_image_url text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_packages (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2),
  inclusions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  available_date date not null,
  start_time time,
  end_time time,
  is_available boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  coordinator_id uuid references public.profiles(id),
  name text not null,
  event_type text,
  event_date date,
  venue text,
  location text,
  guest_count integer,
  total_budget numeric(12,2),
  status public.event_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_requirements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category_id uuid references public.service_categories(id),
  title text not null,
  description text,
  target_budget numeric(12,2),
  priority text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_budget_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category_id uuid references public.service_categories(id),
  label text not null,
  estimated_amount numeric(12,2),
  actual_amount numeric(12,2),
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  client_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.provider_profiles(id),
  service_id uuid not null references public.services(id),
  package_id uuid references public.service_packages(id),
  requested_date date,
  requested_time time,
  amount numeric(12,2),
  status public.booking_status not null default 'requested',
  client_notes text,
  provider_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  payer_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null,
  currency text not null default 'PHP',
  provider text not null default 'paymongo',
  provider_reference text,
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  resource_type text,
  resource_id uuid,
  status public.notification_status not null default 'unread',
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.provider_profiles(id),
  service_id uuid references public.services(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coordination_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  assigned_to uuid references public.profiles(id),
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_role public.user_role,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  previous_state jsonb,
  new_state jsonb,
  result text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.roles (name, description)
values
  ('client', 'Plans and owns event experiences.'),
  ('service_provider', 'Manages services, packages, availability, and bookings.'),
  ('event_coordinator', 'Coordinates assigned event operations.'),
  ('admin', 'Manages platform business operations.'),
  ('superadmin', 'Manages system configuration, security, and governance.')
on conflict (name) do nothing;

insert into public.permissions (code, description)
values
  ('event.create', 'Create events.'),
  ('event.view', 'View authorized events.'),
  ('event.update', 'Update authorized events.'),
  ('service.manage', 'Manage owned provider services.'),
  ('booking.request', 'Request service bookings.'),
  ('booking.respond', 'Approve or reject provider booking requests.'),
  ('payment.create', 'Start payments.'),
  ('payment.verify', 'Verify payment records.'),
  ('message.create', 'Send messages.'),
  ('review.create', 'Submit reviews.'),
  ('admin.manage_users', 'Manage operational user records.'),
  ('superadmin.configure_system', 'Configure system-wide settings.')
on conflict (code) do nothing;

create unique index if not exists provider_profiles_user_id_key
  on public.provider_profiles (user_id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role public.user_role;
begin
  selected_role :=
    case new.raw_user_meta_data ->> 'default_role'
      when 'service_provider' then 'service_provider'::public.user_role
      when 'event_coordinator' then 'event_coordinator'::public.user_role
      when 'admin' then 'admin'::public.user_role
      when 'superadmin' then 'superadmin'::public.user_role
      else 'client'::public.user_role
    end;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    default_role,
    account_status
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    selected_role,
    case
      when selected_role = 'service_provider' then 'pending'::public.account_status
      else 'active'::public.account_status
    end
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    default_role = excluded.default_role,
    account_status = excluded.account_status,
    updated_at = now();

  insert into public.user_roles (user_id, role_id)
  select new.id, public.roles.id
  from public.roles
  where public.roles.name = selected_role
  on conflict (user_id, role_id) do nothing;

  if selected_role = 'service_provider' then
    insert into public.provider_profiles (
      user_id,
      business_name,
      description,
      contact_email,
      contact_phone,
      verification_status
    )
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'business_name', ''), 'Business profile'),
      nullif(new.raw_user_meta_data ->> 'service_category', ''),
      new.email,
      nullif(new.raw_user_meta_data ->> 'phone', ''),
      'pending'::public.account_status
    )
    on conflict (user_id) do update
    set
      business_name = excluded.business_name,
      description = excluded.description,
      contact_email = excluded.contact_email,
      contact_phone = excluded.contact_phone,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.service_categories enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles can be inserted by owner" on public.profiles;
create policy "Profiles can be inserted by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Profiles can be updated by owner" on public.profiles;
create policy "Profiles can be updated by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "User roles are viewable by owner" on public.user_roles;
create policy "User roles are viewable by owner"
  on public.user_roles for select
  using (auth.uid() = user_id);

drop policy if exists "Provider profiles are viewable by owner" on public.provider_profiles;
create policy "Provider profiles are viewable by owner"
  on public.provider_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Provider profiles can be inserted by owner" on public.provider_profiles;
create policy "Provider profiles can be inserted by owner"
  on public.provider_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Provider profiles can be updated by owner" on public.provider_profiles;
create policy "Provider profiles can be updated by owner"
  on public.provider_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Active service categories are public" on public.service_categories;
create policy "Active service categories are public"
  on public.service_categories for select
  using (is_active = true);

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  stock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  paypal_order_id text unique,
  paypal_capture_id text,
  customer_name text not null,
  customer_email text not null,
  shipping_address text,
  city text,
  country text,
  total numeric(12,2) not null,
  currency text not null default 'USD',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  quantity integer not null,
  unit_price numeric(12,2) not null
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_users enable row level security;

create policy "public can read active products" on public.products
for select using (active = true);

create policy "admins can read orders" on public.orders
for select using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

create policy "admins can read order items" on public.order_items
for select using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

insert into public.products(name,description,price,image_url,stock)
values
('Sample Product','Replace this with your own product.',29.00,'https://placehold.co/700x700?text=Product+1',100),
('Sample Product 2','Another sample product.',39.00,'https://placehold.co/700x700?text=Product+2',100)
on conflict do nothing;

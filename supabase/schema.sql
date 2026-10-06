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


create table if not exists public.site_settings(id boolean primary key default true,brand_name text not null default 'MAISON TABLE',hero_title text not null default 'Beautiful moments start at the table.',hero_subtitle text,hero_image_url text,philosophy_title text,philosophy_text text,category1_name text default 'Napkins',category1_image_url text,category2_name text default 'Cups',category2_image_url text,category3_name text default 'Plates',category3_image_url text,updated_at timestamptz not null default now());insert into public.site_settings(id) values(true) on conflict(id) do nothing;alter table public.site_settings enable row level security;drop policy if exists "Public can view site settings" on public.site_settings;create policy "Public can view site settings" on public.site_settings for select using(true);drop policy if exists "Admins can update site settings" on public.site_settings;create policy "Admins can update site settings" on public.site_settings for update to authenticated using(exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));drop policy if exists "Admins can insert site settings" on public.site_settings;create policy "Admins can insert site settings" on public.site_settings for insert to authenticated with check(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));insert into storage.buckets(id,name,public) values('site-images','site-images',true) on conflict(id) do update set public=true;drop policy if exists "Public can view site images" on storage.objects;create policy "Public can view site images" on storage.objects for select using(bucket_id='site-images');drop policy if exists "Admins can upload site images" on storage.objects;create policy "Admins can upload site images" on storage.objects for insert to authenticated with check(bucket_id='site-images' and exists(select 1 from public.admin_users a where a.user_id=auth.uid()));drop policy if exists "Admins can delete site images" on storage.objects;create policy "Admins can delete site images" on storage.objects for delete to authenticated using(bucket_id='site-images' and exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
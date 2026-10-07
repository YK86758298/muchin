create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  category text not null default 'Other',
  best_seller boolean not null default false,
  active boolean not null default true
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
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  tracking_number text
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_users enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "public can read active products" on public.products;
create policy "public can read active products" on public.products
for select to anon, authenticated
using (active = true);

drop policy if exists "admins can manage products" on public.products;
create policy "admins can manage products" on public.products
for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

drop policy if exists "users can read own orders" on public.orders;
create policy "users can read own orders" on public.orders
for select to authenticated
using ((select auth.uid())=user_id);

drop policy if exists "admins can read orders" on public.orders;
create policy "admins can read orders" on public.orders
for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

drop policy if exists "users can cancel own pending orders" on public.orders;
drop policy if exists "admins can update orders" on public.orders;

drop policy if exists "users can read own order items" on public.order_items;
create policy "users can read own order items" on public.order_items
for select to authenticated
using (exists (select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())));

drop policy if exists "admins can read order items" on public.order_items;
create policy "admins can read order items" on public.order_items
for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

drop policy if exists "admins can read own admin record" on public.admin_users;
create policy "admins can read own admin record" on public.admin_users
for select to authenticated
using ((select auth.uid())=user_id);

drop policy if exists "public can read site settings" on public.site_settings;
create policy "public can read site settings" on public.site_settings
for select to anon, authenticated
using (true);

drop policy if exists "admins can manage site settings" on public.site_settings;
create policy "admins can manage site settings" on public.site_settings
for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

insert into storage.buckets (id,name,public)
values ('site-images','site-images',true)
on conflict (id) do update set public=true;

drop policy if exists "public can read site images" on storage.objects;
create policy "public can read site images" on storage.objects
for select to anon, authenticated
using (bucket_id='site-images');

drop policy if exists "admins can upload site images" on storage.objects;
create policy "admins can upload site images" on storage.objects
for insert to authenticated
with check (bucket_id='site-images' and exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

drop policy if exists "admins can update site images" on storage.objects;
create policy "admins can update site images" on storage.objects
for update to authenticated
using (bucket_id='site-images' and exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())))
with check (bucket_id='site-images' and exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

drop policy if exists "admins can delete site images" on storage.objects;
create policy "admins can delete site images" on storage.objects
for delete to authenticated
using (bucket_id='site-images' and exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));


create or replace function public.cancel_pending_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = public as $
declare v_user uuid; v_status text;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'Authentication required'; end if;
  select status into v_status from public.orders where id=p_order_id and user_id=v_user for update;
  if not found then raise exception 'Order not found or not owned by current user'; end if;
  if v_status <> 'pending' then raise exception 'Only pending orders can be cancelled'; end if;
  update public.orders set status='cancelled', cancelled_at=now(), cancellation_reason='Cancelled by customer' where id=p_order_id;
  return true;
end; $;

create or replace function public.admin_update_order(p_order_id uuid,p_status text,p_tracking_number text default null)
returns boolean language plpgsql security definer set search_path = public as $
declare v_status text; v_item record;
begin
  if auth.uid() is null or not exists (select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Admin authorization required'; end if;
  if p_status not in ('pending','paid','shipped','cancelled') then raise exception 'Invalid order status'; end if;
  select status into v_status from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_status=v_status then update public.orders set tracking_number=nullif(trim(coalesce(p_tracking_number,'')),'') where id=p_order_id; return true; end if;
  if v_status='pending' and p_status='paid' then
    for v_item in select product_id,quantity from public.order_items where order_id=p_order_id for update loop
      if v_item.product_id is null or v_item.quantity is null or v_item.quantity<1 then raise exception 'Invalid order item'; end if;
      update public.products set stock=stock-v_item.quantity where id=v_item.product_id and stock>=v_item.quantity;
      if not found then raise exception 'Insufficient stock for product %',v_item.product_id; end if;
    end loop;
    update public.orders set status='paid',tracking_number=nullif(trim(coalesce(p_tracking_number,'')),'') where id=p_order_id; return true;
  end if;
  if v_status='pending' and p_status='cancelled' then
    update public.orders set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),cancellation_reason=coalesce(cancellation_reason,'Cancelled by admin'),tracking_number=null where id=p_order_id; return true;
  end if;
  if v_status='paid' and p_status='shipped' then
    update public.orders set status='shipped',tracking_number=nullif(trim(coalesce(p_tracking_number,'')),'') where id=p_order_id; return true;
  end if;
  raise exception 'Invalid order status transition: % -> %',v_status,p_status;
end; $;

revoke all on function public.cancel_pending_order(uuid) from public,anon;
grant execute on function public.cancel_pending_order(uuid) to authenticated;
revoke all on function public.admin_update_order(uuid,text,text) from public,anon;
grant execute on function public.admin_update_order(uuid,text,text) to authenticated;

create or replace function public.complete_paid_order(p_order_id uuid,p_capture_id text)
returns boolean language plpgsql security invoker set search_path=public as $
declare v_order_status text; v_item record;
begin
  select status into v_order_status from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order_status='paid' then return true; end if;
  if v_order_status not in ('pending','payment_processing') then raise exception 'Order is not payable'; end if;
  for v_item in select product_id,quantity from public.order_items where order_id=p_order_id for update loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity<1 then raise exception 'Invalid order item'; end if;
    update public.products set stock=stock-v_item.quantity where id=v_item.product_id and stock>=v_item.quantity;
    if not found then raise exception 'Insufficient stock for product %',v_item.product_id; end if;
  end loop;
  update public.orders set status='paid',paypal_capture_id=p_capture_id where id=p_order_id;
  return true;
end; $;
revoke all on function public.complete_paid_order(uuid,text) from public,anon,authenticated;
grant execute on function public.complete_paid_order(uuid,text) to service_role;

revoke execute on function public.rls_auto_enable() from anon, authenticated;

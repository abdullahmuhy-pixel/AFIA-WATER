-- AFIA Water: orders database
-- Prices live here and are re-checked on every order, so a tampered page cannot change totals.

create table public.products (
  id text primary key,
  name text not null,
  size text not null,
  kind text not null,
  live boolean not null default false
);

create table public.product_packs (
  product_id text not null references public.products(id) on delete cascade,
  pack_index int not null,
  label text not null,
  units int not null check (units > 0),
  price int not null check (price >= 0),
  primary key (product_id, pack_index)
);

create table public.delivery_zones (
  id int primary key,
  name text not null,
  fee int not null check (fee >= 0),
  active boolean not null default true
);

create type public.order_status as enum ('new','confirmed','paid','out_for_delivery','delivered','cancelled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status public.order_status not null default 'new',
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  phone text not null check (char_length(phone) between 7 and 30),
  address text not null check (char_length(address) between 5 and 500),
  delivery_date date,
  zone_id int references public.delivery_zones(id),
  subtotal int not null,
  delivery_fee int not null,
  total int not null,
  admin_notes text
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  pack_label text not null,
  units int not null,
  unit_price int not null,
  quantity int not null check (quantity between 1 and 1000),
  line_total int not null
);
create index order_items_order_id_idx on public.order_items(order_id);
create index orders_created_at_idx on public.orders(created_at desc);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('event','business')),
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (char_length(phone) between 7 and 30),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','contacted','quoted','won','lost')),
  admin_notes text
);

-- Staff who may see and manage orders, by sign-in email
create table public.admins (email text primary key);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt()->>'email','')));
$$;

alter table public.products enable row level security;
alter table public.product_packs enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.enquiries enable row level security;
alter table public.admins enable row level security;

create policy "catalogue readable" on public.products for select using (true);
create policy "packs readable" on public.product_packs for select using (true);
create policy "zones readable" on public.delivery_zones for select using (true);

create policy "admins read orders" on public.orders for select to authenticated using (public.is_admin());
create policy "admins update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read items" on public.order_items for select to authenticated using (public.is_admin());
create policy "admins read enquiries" on public.enquiries for select to authenticated using (public.is_admin());
create policy "admins update enquiries" on public.enquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins see admins" on public.admins for select to authenticated using (public.is_admin());

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- Public checkout: the only way an order gets in
create or replace function public.place_order(
  p_name text, p_phone text, p_address text, p_delivery_date date, p_zone_id int, p_items jsonb
) returns table (order_code text, subtotal int, delivery_fee int, total int)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_code text; v_sub int := 0; v_bags int := 0; v_fee int; v_item jsonb;
  v_pack record; v_qty int;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'Cart must have 1 to 30 lines';
  end if;
  select fee into v_fee from delivery_zones where id = p_zone_id and active;
  if v_fee is null then raise exception 'Unknown delivery area'; end if;

  v_code := 'AF-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into orders (code, customer_name, phone, address, delivery_date, zone_id, subtotal, delivery_fee, total)
  values (v_code, trim(p_name), trim(p_phone), trim(p_address), p_delivery_date, p_zone_id, 0, 0, 0)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty not between 1 and 1000 then raise exception 'Bad quantity'; end if;
    select pp.*, p.name as pname, p.size as psize into v_pack
      from product_packs pp join products p on p.id = pp.product_id
      where pp.product_id = v_item->>'product_id' and pp.pack_index = (v_item->>'pack_index')::int and p.live;
    if not found then raise exception 'Product not available'; end if;
    insert into order_items (order_id, product_id, product_name, pack_label, units, unit_price, quantity, line_total)
      values (v_id, v_pack.product_id, v_pack.pname || ' ' || v_pack.psize, v_pack.label, v_pack.units, v_pack.price, v_qty, v_pack.price * v_qty);
    v_sub := v_sub + v_pack.price * v_qty;
    if v_pack.product_id = 'omi' then v_bags := v_bags + v_pack.units * v_qty; end if;
  end loop;

  if v_sub >= 50000 or v_bags >= 100 then v_fee := 0; end if;
  update orders o set subtotal = v_sub, delivery_fee = v_fee, total = v_sub + v_fee where o.id = v_id;
  return query select v_code, v_sub, v_fee, v_sub + v_fee;
end; $$;

create or replace function public.submit_enquiry(p_kind text, p_name text, p_phone text, p_details jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if pg_column_size(p_details) > 4000 then raise exception 'Too much detail'; end if;
  insert into enquiries (kind, name, phone, details) values (p_kind, trim(p_name), trim(p_phone), coalesce(p_details,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.place_order(text,text,text,date,int,jsonb) from public;
revoke all on function public.submit_enquiry(text,text,text,jsonb) from public;
revoke all on function public.is_admin() from public;
grant execute on function public.place_order(text,text,text,date,int,jsonb) to anon, authenticated;
grant execute on function public.submit_enquiry(text,text,text,jsonb) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- Live updates on the admin page (row security still applies)
alter publication supabase_realtime add table public.orders;

-- Catalogue (sample launch prices: change here, and keep index.html in step)
insert into products (id, name, size, kind, live) values
 ('col50','Column','50cl','Still',true),
 ('adi33','Adire','33cl','Still',true),
 ('peb75','Pebble','75cl','Still',false),
 ('lag33','Lagoon Sparkling','33cl','Sparkling',false),
 ('lag75','Lagoon Sparkling','75cl','Sparkling',false),
 ('omi','OMI Daily','20 × 50cl per bag','Sachet',true);

insert into product_packs (product_id, pack_index, label, units, price) values
 ('col50',0,'Single',1,1200),('col50',1,'Pack of 12',12,13200),('col50',2,'Case of 24',24,25200),
 ('adi33',0,'Single',1,900),('adi33',1,'Pack of 12',12,9900),('adi33',2,'Case of 24',24,18900),
 ('peb75',0,'Single',1,1800),('peb75',1,'Pack of 6',6,10200),('peb75',2,'Case of 12',12,19800),
 ('lag33',0,'Single',1,1100),('lag33',1,'Case of 24',24,24000),
 ('lag75',0,'Single',1,2200),('lag75',1,'Case of 12',12,24600),
 ('omi',0,'10 bags',10,5500),('omi',1,'50 bags',50,24000),('omi',2,'100 bags · free delivery',100,45000),('omi',3,'200 bags · distributor',200,86000);

insert into delivery_zones (id, name, fee) values
 (0,'Lekki, VI, Ikoyi',2500),
 (1,'Ajah, Sangotedo, Ibeju-Lekki',3500),
 (2,'Ikeja, Yaba, Surulere, Gbagada, Maryland',3000),
 (3,'Ikorodu, Alimosho, Festac, Badagry road',4500),
 (4,'Pickup from factory',0);

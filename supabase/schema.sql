-- Run this whole file once in Supabase: SQL Editor > New query > Run
create extension if not exists pgcrypto;

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);
insert into settings (id, data) values (1, '{}'::jsonb) on conflict do nothing;

create table if not exists room_types (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null,                       -- {"en":"","am":"","om":""}
  description jsonb not null default '{}'::jsonb,
  price_per_night numeric(10,2) not null check (price_per_night >= 0),
  capacity int not null default 2 check (capacity > 0),
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  room_type_id uuid not null references room_types(id) on delete restrict,
  active boolean not null default true
);

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin','receptionist')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('EK' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  room_id uuid not null references rooms(id),
  room_type_id uuid not null references room_types(id),
  guest_name text not null,
  guest_email text,
  guest_phone text,
  guests int not null default 1,
  check_in date not null,
  check_out date not null,
  nights int not null,
  total numeric(10,2) not null default 0,
  status text not null check (status in ('pending','confirmed','checked_in','checked_out','cancelled','expired','blocked')),
  source text not null default 'online' check (source in ('online','reception')),
  payment_method text,
  payment_reference text,
  checkout_url text,
  hold_expires_at timestamptz,
  confirmation_sent boolean not null default false,
  refund_amount numeric(10,2) not null default 0,
  refund_status text not null default 'none' check (refund_status in ('none','due','paid')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (check_out > check_in)
);
create index if not exists bookings_room_dates on bookings (room_id, check_in, check_out);
create index if not exists bookings_status on bookings (status);

-- Only the server (service role key) may touch these tables.
alter table settings enable row level security;
alter table room_types enable row level security;
alter table rooms enable row level security;
alter table staff enable row level security;
alter table bookings enable row level security;

-- Is a room taken for these dates? (pending bookings only count while their 10-minute hold is alive)
create or replace function is_room_busy(p_room uuid, p_in date, p_out date, p_except uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from bookings b
    where b.room_id = p_room
      and b.id is distinct from p_except
      and b.check_in < p_out and b.check_out > p_in
      and (b.status in ('confirmed','checked_in','blocked')
           or (b.status = 'pending' and b.hold_expires_at > now()))
  );
$$;

-- Creates a booking safely: one lock, so two guests can never get the same room.
create or replace function create_booking(
  p_room_type uuid, p_room uuid, p_in date, p_out date,
  p_name text, p_email text, p_phone text, p_guests int,
  p_source text, p_status text, p_hold_minutes int,
  p_method text, p_pay_ref text, p_notes text, p_by uuid
) returns bookings language plpgsql as $$
declare v_room uuid; v_type uuid; v_price numeric; v_nights int; r bookings;
begin
  perform pg_advisory_xact_lock(7001);
  if p_out <= p_in then raise exception 'INVALID_DATES'; end if;
  v_nights := p_out - p_in;
  if p_room is not null then
    select room_type_id into v_type from rooms where id = p_room and active;
    if v_type is null then raise exception 'ROOM_NOT_FOUND'; end if;
    if is_room_busy(p_room, p_in, p_out, null) then raise exception 'ROOM_TAKEN'; end if;
    v_room := p_room;
  else
    v_type := p_room_type;
    select rm.id into v_room from rooms rm
      where rm.room_type_id = v_type and rm.active and not is_room_busy(rm.id, p_in, p_out, null)
      order by rm.number limit 1;
    if v_room is null then raise exception 'NO_AVAILABILITY'; end if;
  end if;
  select price_per_night into v_price from room_types where id = v_type;
  insert into bookings (room_id, room_type_id, guest_name, guest_email, guest_phone, guests,
      check_in, check_out, nights, total, status, source, payment_method, payment_reference,
      hold_expires_at, notes, created_by)
  values (v_room, v_type, p_name, p_email, p_phone, p_guests, p_in, p_out, v_nights,
      case when p_status = 'blocked' then 0 else v_price * v_nights end,
      p_status, p_source, p_method, p_pay_ref,
      case when p_status = 'pending' then now() + make_interval(mins => p_hold_minutes) end,
      p_notes, p_by)
  returning * into r;
  return r;
end $$;

-- Called after Chapa confirms payment. If the room was lost meanwhile, the booking is
-- cancelled and a full refund is flagged for the admin.
create or replace function confirm_booking(p_ref text, p_pay_ref text, p_method text)
returns bookings language plpgsql as $$
declare b bookings;
begin
  perform pg_advisory_xact_lock(7001);
  select * into b from bookings where reference = p_ref for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.status not in ('pending','expired') then return b; end if;
  if is_room_busy(b.room_id, b.check_in, b.check_out, b.id) then
    update bookings set status = 'cancelled', cancelled_at = now(), refund_amount = total,
      refund_status = 'due', payment_reference = p_pay_ref, payment_method = p_method,
      notes = coalesce(notes || ' | ', '') || 'Paid after hold expired; room no longer free'
      where id = b.id returning * into b;
    return b;
  end if;
  update bookings set status = 'confirmed', hold_expires_at = null,
    payment_reference = p_pay_ref, payment_method = p_method
    where id = b.id returning * into b;
  return b;
end $$;

-- Public bucket for room and hero photos
insert into storage.buckets (id, name, public) values ('rooms', 'rooms', true) on conflict (id) do nothing;

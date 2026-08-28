create table customers (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null unique
);

create table flights (
  id bigint generated always as identity primary key,
  destination text not null,
  depart_at timestamptz not null
);

create table bookings (
  id bigint generated always as identity primary key,
  customer_id bigint not null references customers (id) on delete cascade,
  flight_id bigint not null references flights (id) on delete cascade
);

create index bookings_customer_id_idx on bookings (customer_id);
create index bookings_flight_id_idx on bookings (flight_id);

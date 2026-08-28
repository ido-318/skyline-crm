insert into customers (name, email) values
  ('Alice Johnson', 'alice.johnson@example.com'),
  ('Bob Smith', 'bob.smith@example.com'),
  ('Carla Diaz', 'carla.diaz@example.com'),
  ('David Chen', 'david.chen@example.com'),
  ('Emma Novak', 'emma.novak@example.com');

insert into flights (destination, depart_at) values
  ('Paris', '2026-09-10 08:30:00+00'),
  ('Tokyo', '2026-09-12 22:15:00+00'),
  ('New York', '2026-09-15 14:00:00+00'),
  ('Berlin', '2026-09-18 06:45:00+00'),
  ('Sydney', '2026-09-20 19:20:00+00');

insert into bookings (customer_id, flight_id) values
  (1, 1),
  (1, 3),
  (2, 2),
  (3, 4),
  (4, 5),
  (5, 1);

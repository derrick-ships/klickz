-- Ensure Supabase service_role (used by durable Inngest background workers and unlisted report loader)
-- has full DML privileges on all public tables and future tables.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

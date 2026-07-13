-- Per-project identity color (a hue token key like 'blue' / 'green'), so
-- projects in the same stage can be told apart at a glance. Null = no color.
alter table public.projects add column if not exists color text;

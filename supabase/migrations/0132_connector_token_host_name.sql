-- Which assistant last connected through an AI connector link ("claude-ai",
-- "ChatGPT"), as it named itself when it connected. It is what lets the
-- dashboard say "Claude connected" rather than "an assistant". Self-reported
-- by the host, so it is a label and never a permission.
alter table public.connector_tokens add column host_name text;

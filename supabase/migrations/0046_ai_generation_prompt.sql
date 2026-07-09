-- 0046: the exact prompt lives on each generation.
-- A batch can share a prompt, but tweaks change the prompt per image, so the
-- authoritative prompt is per-candidate (the stage prompt is just a working
-- base that pre-fills new batches).
alter table public.ai_generations add column prompt text;

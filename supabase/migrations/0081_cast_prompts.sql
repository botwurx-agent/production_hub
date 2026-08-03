-- The prompt that produces this character, element, location or crowd, and the
-- prompt that produces a look.
--
-- It sits on the entity rather than on a generation because it is the RECIPE,
-- not a record of one attempt: ai_generations.prompt already stores what was
-- actually sent for a given sheet, and those two answer different questions
-- ("what do I paste next time" vs "what made this file").
alter table public.ai_entities add column if not exists prompt text;
alter table public.ai_looks add column if not exists prompt text;

comment on column public.ai_entities.prompt is
  'The reusable prompt that generates this entity''s sheets. The recipe, not a log of one generation.';
comment on column public.ai_looks.prompt is
  'The reusable prompt that generates this look''s combined sheet.';

-- A shot's production notes, separate from what is said or shown over it.
--
-- shot_cards had `vo` (voiceover / on-screen supers) and nothing else free
-- text, so the PDF importer wrote the deck's NOTES section into `vo`: a shot
-- list imported from a treatment came back with camera, staging and build
-- notes filed under "VO / OST". They are different things and a producer needs
-- both on the same row.
--
-- Additive and nullable. Nothing is moved: existing `vo` content stays exactly
-- where it is, because it is the operator's own writing and deciding whether a
-- given line is a note or a voiceover is theirs to make, not a migration's.
alter table public.shot_cards add column if not exists notes text;

comment on column public.shot_cards.vo is
  'Voiceover, dialogue or on-screen supers for this shot: what is heard or read.';
comment on column public.shot_cards.notes is
  'Production notes for this shot: camera, staging, build. See migration 0101.';

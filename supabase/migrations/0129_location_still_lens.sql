-- 0129: the lens a location still was framed for.
--
-- The viewfinder now picks a lens from a library (maker, series, focal
-- length), with an optional extender and anamorphic sets. A still keeps the
-- set's name so the frame can be read back as "Cooke S4/i 32mm", and the
-- squeeze so its angle of view can be worked out again (an anamorphic lens
-- sees wider than a spherical one of the same focal length).
-- focal_mm stays the effective focal length (lens x extender).

alter table public.location_stills
  add column if not exists lens_name text,
  add column if not exists squeeze double precision not null default 1;

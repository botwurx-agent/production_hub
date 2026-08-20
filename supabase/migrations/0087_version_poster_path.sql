-- A rendered first-page image for a file that is not itself an image.
--
-- A PDF drew a grey document icon in every grid, so a folder of storyboards,
-- treatments and permits looked identical and you had to open each one to know
-- which was which. The poster is page one, rendered once in the browser with
-- the same pdf.js the importer uses, then stored so nobody pays for it twice.
--
-- It hangs off the VERSION, not the asset: v2 of a board has a different first
-- page from v1, and the grid shows whichever version is current.
--
-- Nullable and always regenerable: deleting the file it points at costs a
-- thumbnail, never a document.
alter table versions add column if not exists poster_path text;

comment on column versions.poster_path is
  'Storage path of a rendered page-1 preview for non-image files (PDF). Null until generated; safe to clear, it is rebuilt on next view.';

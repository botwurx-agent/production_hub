-- Boards get a kind so project-level Storyboards and Moodboards are distinct
-- surfaces, separate from the studio-wide "general" boards in the left nav.
-- Values: 'general' (global scratch), 'moodboard', 'storyboard'.
alter table boards
  add column if not exists kind text not null default 'general';

-- Per-board canvas background style: 'dots' | 'grid' | 'plain'.
alter table public.boards
  add column background text not null default 'dots';

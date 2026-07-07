-- Allow client approvals on doc surfaces (shot list / storyboard / moodboard),
-- not just asset versions. Extends the approval_target enum used by approvals.
alter type public.approval_target add value if not exists 'shot_list';
alter type public.approval_target add value if not exists 'storyboard';
alter type public.approval_target add value if not exists 'moodboard';

-- A review comment the client never sees.
--
-- Team and client comments share one stream per version (and per doc
-- target), so until now every note a team member left in the in-app review
-- canvas was also served to the client on the /r/<token> portal: "the
-- editor missed this again" landed in front of the brand.
--
-- team_only = true keeps a comment, and every reply under it, inside the
-- studio. The public portal loaders filter on it and the portal's own write
-- actions refuse to touch one. In-app readers (studio members and project
-- collaborators) still see it, marked "Team only".
--
-- Default false, so every existing comment keeps behaving exactly as it did.

alter table public.review_comments
  add column team_only boolean not null default false;

comment on column public.review_comments.team_only is
  'Hidden from the public client review portal. Replies under a team_only comment are team_only too.';

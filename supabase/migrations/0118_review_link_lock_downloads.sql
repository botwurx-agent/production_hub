-- Lock a client review link's downloads until the work is approved.
--
-- While on, the client can watch, comment and approve, but the portal offers
-- no download, the file route refuses a download request, and the player's
-- frame grab is withheld. It opens by itself once the asset is approved (by
-- the studio's own sign-off, or the client approving the latest version
-- through this link), so nobody has to remember to come back and unlock it.
--
-- A DETERRENT, NOT DRM: the media still has to reach the browser to be
-- watched. It takes away the button and the route, which is what stops a
-- client walking off with an unapproved cut in ordinary use.
--
-- Default false, so every existing link behaves exactly as it did.

alter table public.review_links
  add column lock_downloads boolean not null default false;

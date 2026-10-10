-- A voice note on a review comment, beside text and drawings. The file lives
-- in the assets bucket under <studio>/voice/ and is played back only through
-- access-checked routes (/api/voice/<id> in the app, /r/<token>/voice/<id> on
-- the client portal), never signed into a page. A comment can be a voice note
-- with no text, so the body may be empty when audio_path is set.
alter table public.review_comments add column audio_path text;
alter table public.review_comments add column audio_seconds numeric(5,1)
  check (audio_seconds is null or (audio_seconds >= 0 and audio_seconds <= 300));
comment on column public.review_comments.audio_path is 'A recorded voice note in the assets bucket under <studio>/voice/. Played back only through access-checked routes, never signed into a page.';

-- The bucket had no size limit of its own, which is the enforcement layer the
-- direct-upload design depends on.
--
-- WHY IT MATTERS MORE THAN IT SOUNDS. An upload that goes straight to Storage
-- under a signed URL never passes through our code, so the server never sees
-- the bytes. The browser DECLARES a size when it asks for a ticket, and it can
-- lie. There are three checks and this is the only one that cannot be talked
-- around:
--
--   1. lib/upload-limits.ts, mirrored in the picker, so an oversized file is
--      refused before the upload rather than after. Advisory.
--   2. mintUploadTicket, against the declared size. Also advisory, since the
--      declaration is the thing being checked.
--   3. finalizeUpload, which reads the object's REAL size back from Storage
--      before any row points at it and deletes anything over. Authoritative,
--      but only after the bytes have already been stored.
--   4. THIS. Storage refuses the write itself, so nothing lands at all.
--
-- With file_size_limit null the bucket falls back to the project-wide upload
-- limit, an invisible dashboard setting neither the code nor this repository
-- records. An explicit value means the ceiling is stated where the rest of the
-- schema lives, and a change to it is a commit rather than a click somebody
-- has to remember.
--
-- 2GB matches MAX_MEDIA_BYTES, the largest any scope may authorize (a cut, a
-- master, a location walkthrough). Documents and images are held far lower per
-- scope in lib/upload-ticket.ts; this is the outer wall, not the policy.
--
-- NOTE FOR WHOEVER RAISES IT NEXT: Supabase enforces the LOWER of this and the
-- project-wide limit in Settings -> Storage, so raising this alone is not
-- enough if the global is still at its default. Applied to the live project on
-- 2026-09-07.

update storage.buckets
set file_size_limit = 2000000000
where id = 'assets';

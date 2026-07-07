-- Video review: a comment can be tied to a timecode (seconds) on the video
-- timeline, the time-axis analogue of an image pin's (x, y).
alter table review_comments
  add column if not exists timecode real;

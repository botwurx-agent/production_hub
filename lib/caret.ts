/**
 * Insert text at the caret of a textarea rather than appending it.
 *
 * Appending is wrong for anything you write mid-sentence, which is exactly what
 * a cast handle is: "@maya walks past @bottle_hero" needs both dropped where
 * the cursor is.
 *
 * Falls back to appending when there is no element, so a caller never has to
 * branch on the ref being ready.
 *
 * NOTE: components/review/video-review.tsx carries an identical local copy for
 * its emoji picker. Collapsing the two is a tidy-up worth doing next time that
 * file is open for another reason; it is not worth touching a working review
 * composer for on its own.
 */
export function insertAtCaret(
  el: HTMLTextAreaElement | null,
  value: string,
  insert: string,
  set: (next: string) => void
) {
  if (!el) {
    set(value + insert);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  set(value.slice(0, start) + insert + value.slice(end));
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + insert.length, start + insert.length);
  });
}

/**
 * Insert with the spacing a human would use: one space before if the caret is
 * mid-text and the preceding character is not already whitespace, one after.
 * Without this, clicking two chips in a row produces "@maya@maya_wd1".
 */
export function insertToken(
  el: HTMLTextAreaElement | null,
  value: string,
  token: string,
  set: (next: string) => void
) {
  const start = el?.selectionStart ?? value.length;
  const before = value.slice(0, start);
  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
  insertAtCaret(el, value, `${needsLeadingSpace ? " " : ""}${token} `, set);
}

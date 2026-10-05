// Sample storyboard frames for the Scene Setup prototype, drawn as pencil line
// art so they are obviously sketches and never pass for a render. They sit a
// little off the default camera positions on purpose: matching the camera to
// the board is the task the prototype exists to test. A real board replaces
// one with "Use my own frame".

const paper = "#f7f3ea";
const ink = "#3b3530";

function svg(body: string): string {
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">` +
    `<rect width="1600" height="900" fill="${paper}"/>` +
    `<g fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${body}</g>` +
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(doc);
}

// A figure as a sketch: head oval, torso, limbs. (x, y) is the feet, h the
// height in pixels.
function person(x: number, y: number, h: number, seated = false): string {
  const head = h * 0.13;
  const sh = y - h * 0.82;
  const hip = seated ? y - h * 0.32 : y - h * 0.5;
  let s = `<ellipse cx="${x}" cy="${sh - head * 0.75}" rx="${head * 0.42}" ry="${head * 0.55}"/>`;
  s += `<path d="M${x - h * 0.12} ${sh} Q${x} ${sh - h * 0.03} ${x + h * 0.12} ${sh} L${x + h * 0.1} ${hip} L${x - h * 0.1} ${hip} Z"/>`;
  s += `<path d="M${x - h * 0.12} ${sh + 6} L${x - h * 0.16} ${sh + h * 0.3}"/><path d="M${x + h * 0.12} ${sh + 6} L${x + h * 0.16} ${sh + h * 0.3}"/>`;
  if (!seated) s += `<path d="M${x - h * 0.06} ${hip} L${x - h * 0.07} ${y}"/><path d="M${x + h * 0.06} ${hip} L${x + h * 0.07} ${y}"/>`;
  return s;
}

export const SAMPLE_BOARDS: Record<string, string> = {
  // 1A: the wide. Window camera left, counter across the back, table centre.
  "1A": svg(
    `<path d="M0 560 L1600 560" stroke-width="3" opacity=".5"/>` +
      `<rect x="70" y="150" width="210" height="300" stroke-width="4"/><path d="M175 150 L175 450"/>` +
      `<path d="M560 330 L1330 330 L1330 560 L560 560 Z"/><path d="M560 230 L1330 230 L1330 300 L560 300 Z"/>` +
      `<path d="M520 650 L1080 650 L1150 720 L460 720 Z"/><path d="M500 720 L500 830"/><path d="M1110 720 L1110 830"/>` +
      `<path d="M795 380 L795 470"/><path d="M745 500 Q795 465 845 500"/>` +
      person(470, 790, 380) +
      person(880, 650, 330, true) +
      `<path d="M820 640 L828 600 L836 640" stroke-width="4"/>` +
      `<text x="40" y="870" font-family="Helvetica, Arial" font-size="34" fill="${ink}" stroke="none">1A  WIDE. Maya waits as Leo opens the bottle.</text>`,
  ),
  // 1B: the two-shot, tighter, Maya camera left in profile, Leo seated right.
  "1B": svg(
    `<path d="M0 520 L1600 520" stroke-width="3" opacity=".4"/>` +
      `<path d="M260 760 L1400 760 L1500 900 L160 900 Z"/>` +
      person(470, 1100, 900) +
      person(1040, 930, 720, true) +
      `<path d="M820 750 L820 640 Q830 610 840 640 L840 750" stroke-width="5"/>` +
      `<text x="40" y="870" font-family="Helvetica, Arial" font-size="34" fill="${ink}" stroke="none">1B  TWO SHOT. Their eyeline across the table.</text>`,
  ),
  // 1C: the product close-up, bottle centre on the table, soft room behind.
  "1C": svg(
    `<path d="M0 640 L1600 640" stroke-width="4"/>` +
      `<path d="M700 640 L700 300 Q700 250 740 230 L760 160 L760 100 L840 100 L840 160 L860 230 Q900 250 900 300 L900 640" stroke-width="6"/>` +
      `<rect x="700" y="380" width="200" height="150" stroke-width="5"/>` +
      `<path d="M720 450 L880 450" stroke-width="3"/>` +
      `<path d="M1150 640 Q1180 520 1260 500 L1420 470" stroke-width="5" opacity=".7"/>` +
      `<text x="40" y="870" font-family="Helvetica, Arial" font-size="34" fill="${ink}" stroke="none">1C  CU PRODUCT. Label to lens, hand enters right.</text>`,
  ),
};

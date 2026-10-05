// Scene Setup PROTOTYPE, slice 1 (camera and lens truth). A throwaway for the
// operator to judge how the 3D previz feels to drive before anything real is
// built: no database, no app wiring, nothing saved. See CLAUDE.md, "Scene
// Setup: 3D previz". Auth-gated in production by the /dev/* rule.
import { PrevizPrototype } from "@/components/previz/previz-prototype";

export const metadata = { title: "Scene setup prototype" };

export default function Page() {
  return <PrevizPrototype />;
}

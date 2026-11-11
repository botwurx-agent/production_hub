import type * as Actions from "@/app/(app)/boards/actions";
import { BOARD_RPC, type BoardRpcName } from "@/lib/board-rpc-names";
import { toast } from "@/components/ui/toast";

/**
 * The moodboard's calls to the server, as plain fetches to /api/boards/rpc
 * rather than Server Actions. Import a function from here exactly as it was
 * imported from the actions file; the signature is the same.
 *
 * See the route for why. The short version: a Server Action in flight parks a
 * pending promise in Next's router, and a canvas that keeps re-rendering while
 * one is pending crashes the whole app (React error #482).
 *
 * ORDER IS KEPT. Calls run one after another, in the order they were made,
 * which is what the Server Action queue did and what the editor relies on: a
 * reload asked for after a save must not come back before the save lands, or
 * the card snaps to where it used to be.
 */

type Api = Pick<typeof Actions, BoardRpcName>;

let chain: Promise<unknown> = Promise.resolve();
let lastFailureToast = 0;

function failed(message: string) {
  // One notice per burst: a dropped connection fails every queued save at
  // once, and ten identical toasts say nothing the first did not.
  const now = Date.now();
  if (now - lastFailureToast < 4000) return;
  lastFailureToast = now;
  toast(message, "error");
}

async function send(name: string, args: unknown[]): Promise<unknown> {
  const u: number[] = [];
  args.forEach((a, i) => {
    if (a === undefined) u.push(i);
  });
  let res: Response;
  try {
    res = await fetch("/api/boards/rpc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, args, u }),
      // A signed-out session is answered with a redirect to the login page.
      // Following it would hand back HTML and read as a successful save.
      redirect: "manual",
    });
  } catch (e) {
    failed("Could not reach the server, so that change is not saved yet. Check your connection.");
    throw e;
  }
  if (res.type === "opaqueredirect" || res.status === 401 || (res.status >= 300 && res.status < 400)) {
    failed("You have been signed out. Reload the page to sign in again; recent changes may not be saved.");
    throw new Error("Board call refused: signed out");
  }
  if (!res.ok) {
    failed("That change did not save. Reload the board to see what was kept.");
    throw new Error(`Board call ${name} failed (${res.status})`);
  }
  const json = (await res.json()) as { result?: unknown };
  return json.result ?? null;
}

function rpc<K extends BoardRpcName>(name: K): Api[K] {
  const fn = (...args: unknown[]) => {
    const run = () => send(name, args);
    const p = chain.then(run, run);
    // The chain itself never rejects, or one failed save would refuse every
    // call queued behind it. The caller still sees its own failure.
    chain = p.catch(() => undefined);
    return p;
  };
  return fn as unknown as Api[K];
}

const api = Object.fromEntries(BOARD_RPC.map((n) => [n, rpc(n)])) as unknown as Api;

export const {
  getBoardData,
  restoreBoardState,
  getBoardShare,
  createBoardShare,
  revokeBoardShare,
  registerUploadedBoardItems,
  addAssetItems,
  addDriveItems,
  addFigmaItems,
  addNote,
  addLine,
  addColumn,
  addColorItem,
  addVideoItem,
  addShapeItem,
  addHeadingItem,
  addLinkItem,
  addTodoItem,
  duplicateItem,
  attachToColumn,
  detachFromColumn,
  setColumnOrder,
  updateItemName,
  updateItemText,
  updateItemHue,
  addConnection,
  deleteConnection,
  moveItem,
  moveItems,
  resizeItem,
  bringToFront,
  deleteItem,
  deleteItems,
  getProjectAssetsForBoard,
} = api;

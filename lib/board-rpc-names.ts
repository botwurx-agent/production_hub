/**
 * The board functions the editor may call over /api/boards/rpc. One list, read
 * by the route (as its allowlist) and by lib/board-api (as its surface), so a
 * name cannot be callable from one side and unknown to the other.
 *
 * The five BOARD-level actions (create, rename, background, project, delete)
 * are deliberately absent: they change what the server rendered, so they stay
 * Server Actions and keep their revalidation. Everything here touches items,
 * which only the client holds.
 */
export const BOARD_RPC = [
  "getBoardData",
  "restoreBoardState",
  "getBoardShare",
  "createBoardShare",
  "revokeBoardShare",
  "registerUploadedBoardItems",
  "addAssetItems",
  "addDriveItems",
  "addFigmaItems",
  "addNote",
  "addLine",
  "addColumn",
  "addColorItem",
  "addVideoItem",
  "addShapeItem",
  "addHeadingItem",
  "addLinkItem",
  "addTodoItem",
  "duplicateItem",
  "attachToColumn",
  "detachFromColumn",
  "setColumnOrder",
  "updateItemName",
  "updateItemText",
  "updateItemHue",
  "addConnection",
  "deleteConnection",
  "moveItem",
  "moveItems",
  "resizeItem",
  "bringToFront",
  "deleteItem",
  "deleteItems",
  "getProjectAssetsForBoard",
] as const;

export type BoardRpcName = (typeof BOARD_RPC)[number];

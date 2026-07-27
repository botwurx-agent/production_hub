// The reaction set offered on a review comment. A short, fixed list: it is a
// whitelist (the public portal writes these straight to the database), and a
// long list turns a decision tool into a chat room.
export const REACTIONS = ["👍", "👎", "❤️", "🔥", "👀", "🎉", "❓"];

export type CommentReaction = {
  emoji: string;
  count: number;
  // Whether the current viewer is one of the reactors.
  mine: boolean;
  names: string[];
};

"use client";

import { PinCanvas } from "@/components/review/pin-canvas";
import type { PortalComment } from "@/lib/review-links";

// Frame.io-style pinned review for an image asset: thin wrapper that hands the
// image to the generic PinCanvas as the pinnable surface.
export function PinReview({
  imageUrl,
  alt,
  comments,
  canResolve = true,
  disabled = false,
  disabledHint,
  wide = false,
  onPost,
  onResolve,
}: {
  imageUrl: string;
  alt: string;
  comments: PortalComment[];
  canResolve?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  wide?: boolean;
  onPost: (text: string, pin: { x: number; y: number } | null) => Promise<boolean>;
  onResolve?: (id: string, resolved: boolean) => void;
}) {
  return (
    <PinCanvas
      comments={comments}
      canResolve={canResolve}
      disabled={disabled}
      disabledHint={disabledHint}
      wide={wide}
      emptyHint="Click anywhere on the image to drop a pin and start."
      onPost={onPost}
      onResolve={onResolve}
      stage={
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          className="block max-h-[66vh] w-auto max-w-full rounded-[10px] object-contain shadow-2xl"
          draggable={false}
        />
      }
    />
  );
}

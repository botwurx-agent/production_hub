import type { Metadata } from "next";
import { PhoneRemote } from "@/components/phone-cam/phone-remote";
import { cleanRoom } from "@/lib/phone-cam";

// The phone half of the phone camera in shot blocking, opened from the QR
// code in the studio. Signing in is required (the middleware sends a signed-out
// phone to the login page and back); nothing here reads or writes the database.

export const metadata: Metadata = { title: "Phone camera", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function PhoneCameraPage({ searchParams }: { searchParams: { room?: string } }) {
  const room = cleanRoom(searchParams.room);
  if (!room) {
    return (
      <div data-theme="dark" className="flex min-h-[100dvh] items-center justify-center bg-black p-6 text-center text-white">
        <p className="max-w-[300px] text-[15px] text-white/70">
          This link is missing its code. Open shot blocking on your computer, press Phone camera, and scan the QR code again.
        </p>
      </div>
    );
  }
  return <PhoneRemote room={room} />;
}

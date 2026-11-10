// Latency test for "the phone is the camera" in shot blocking. Open it on a
// computer for the desk view and QR code; the phone opens ?room=... from the
// code. /dev pages are public in development and auth-gated in production,
// so on the deployment both devices sign in.
import type { Metadata } from "next";
import { PhoneCamTest } from "@/components/dev/phone-cam-test";
import { cleanRoom } from "@/lib/phone-cam";

export const metadata: Metadata = { title: "Phone camera latency test", robots: { index: false } };

export default function Page({ searchParams }: { searchParams: { room?: string } }) {
  return <PhoneCamTest room={cleanRoom(searchParams.room)} />;
}

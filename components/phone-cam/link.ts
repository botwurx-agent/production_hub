"use client";

// The link between the desk (the computer) and the phone, shared by the
// latency test (/dev/phone-cam) and the phone camera in shot blocking. Two
// transports: RELAY is a Supabase Realtime broadcast channel, DIRECT is a
// WebRTC data channel the relay introduces. send() uses direct when it is
// open and the relay otherwise. Nothing is written to the database.

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Msg } from "@/lib/phone-cam";

export type Transport = "relay" | "direct";
type Channel = ReturnType<ReturnType<typeof createClient>["channel"]>;

const STUN: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/** One link to the other device: the relay channel, plus an optional data channel. */
export function useLink(room: string | null, me: "phone" | "desk", onMsg: (m: Msg) => void) {
  const [status, setStatus] = useState<"off" | "joining" | "on" | "error">("off");
  const [error, setError] = useState<string | null>(null);
  const [direct, setDirect] = useState<"none" | "connecting" | "open" | "failed">("none");
  const chan = useRef<Channel | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const dc = useRef<RTCDataChannel | null>(null);
  const handler = useRef(onMsg);
  handler.current = onMsg;

  const raw = (m: Msg) => {
    void chan.current?.send({ type: "broadcast", event: "m", payload: m });
  };

  const wireDc = (d: RTCDataChannel) => {
    dc.current = d;
    d.onopen = () => setDirect("open");
    d.onclose = () => setDirect((s) => (s === "open" ? "failed" : s));
    d.onmessage = (e) => {
      try {
        handler.current(JSON.parse(String(e.data)) as Msg);
      } catch {
        /* not ours */
      }
    };
  };

  const newPc = () => {
    pc.current?.close();
    const p = new RTCPeerConnection(STUN);
    p.onicecandidate = (e) => {
      if (e.candidate) raw({ k: "signal", to: me === "desk" ? "phone" : "desk", ice: e.candidate.toJSON() });
    };
    p.onconnectionstatechange = () => {
      if (p.connectionState === "failed") setDirect("failed");
    };
    pc.current = p;
    return p;
  };

  const onSignal = async (m: Extract<Msg, { k: "signal" }>) => {
    if (m.to !== me) return;
    try {
      if (m.sdp) {
        const desc = m.sdp as RTCSessionDescriptionInit;
        if (desc.type === "offer") {
          const p = newPc();
          p.ondatachannel = (e) => wireDc(e.channel);
          setDirect("connecting");
          await p.setRemoteDescription(desc);
          const ans = await p.createAnswer();
          await p.setLocalDescription(ans);
          raw({ k: "signal", to: "desk", sdp: p.localDescription?.toJSON() });
        } else if (pc.current) {
          await pc.current.setRemoteDescription(desc);
        }
      } else if (m.ice && pc.current) {
        await pc.current.addIceCandidate(m.ice as RTCIceCandidateInit);
      }
    } catch {
      setDirect("failed");
    }
  };

  useEffect(() => {
    if (!room) return;
    setStatus("joining");
    const supabase = createClient();
    const c = supabase.channel(`phonecam:${room}`, { config: { broadcast: { self: false, ack: false } } });
    c.on("broadcast", { event: "m" }, ({ payload }) => {
      const m = payload as Msg;
      if (m?.k === "signal") void onSignal(m);
      else handler.current(m);
    });
    c.subscribe((s, err) => {
      if (s === "SUBSCRIBED") {
        setStatus("on");
        raw({ k: "hello", from: me });
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
        setStatus("error");
        setError(err?.message || (s === "TIMED_OUT" ? "Timed out joining the relay." : "The relay refused the channel."));
      }
    });
    chan.current = c;
    return () => {
      void supabase.removeChannel(c);
      pc.current?.close();
      chan.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, me]);

  const goDirect = async () => {
    const p = newPc();
    wireDc(p.createDataChannel("pose", { ordered: false, maxRetransmits: 0 }));
    setDirect("connecting");
    const offer = await p.createOffer();
    await p.setLocalDescription(offer);
    raw({ k: "signal", to: "phone", sdp: p.localDescription?.toJSON() });
    setTimeout(() => setDirect((s) => (s === "connecting" ? "failed" : s)), 10000);
  };

  const dropDirect = () => {
    pc.current?.close();
    pc.current = null;
    dc.current = null;
    setDirect("none");
  };

  /** Sends over the direct channel when it is open, else the relay. */
  const send = (m: Msg) => {
    const d = dc.current;
    if (d && d.readyState === "open") {
      try {
        d.send(JSON.stringify(m));
        return;
      } catch {
        /* fall through */
      }
    }
    raw(m);
  };

  const transport: Transport = direct === "open" ? "direct" : "relay";
  return { status, error, direct, transport, send, goDirect, dropDirect };
}


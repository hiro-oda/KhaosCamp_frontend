"use client";

import { CloseIcon } from "@/components/CloseIcon";
// import { NoAgentNotification } from "@/components/NoAgentNotification";
// import TranscriptionView from "@/components/TranscriptionView";
import dynamic from 'next/dynamic';
import {
  DisconnectButton,
  RoomAudioRenderer,
  RoomContext,
  useVoiceAssistant,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { Room, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState, useContext} from "react";
import type { ConnectionDetails } from "./api/connection-details/route";

export default function Page() {
  const [room] = useState(new Room());

  const onConnectButtonClicked = useCallback(async () => {
    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details",
      window.location.origin
    );
    const response = await fetch(url.toString());
    const connectionDetailsData: ConnectionDetails = await response.json();

    await room.connect(
      connectionDetailsData.serverUrl,
      connectionDetailsData.participantToken
    );
    await room.localParticipant.setMicrophoneEnabled(false);
  }, [room]);

  useEffect(() => {
    room.on(RoomEvent.MediaDevicesError, onDeviceFailure);
    return () => {
      room.off(RoomEvent.MediaDevicesError, onDeviceFailure);
    };
  }, [room]);

  return (
    <main data-lk-theme="default" className="h-full grid content-center bg-black">
      <RoomContext.Provider value={room}>
      <div className="lk-room-container w-screen h-screen overflow-hidden">
          <SimpleVoiceAssistant onConnectButtonClicked={onConnectButtonClicked} />
        </div>
      </RoomContext.Provider>
    </main>
  );
}

function SimpleVoiceAssistant(props: { onConnectButtonClicked: () => void }) {
  const { state: agentState } = useVoiceAssistant();
  const room = useContext(RoomContext)!;
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    if (agentState !== "disconnected" && !hasPlayedRef.current) {
      room.localParticipant.setMicrophoneEnabled(false).catch(err => console.warn('Mic disable failed:', err));
      const audio = new Audio('/initial_speech.wav');
      audio.play().catch((err) => console.warn('Audio playback failed:', err));
      hasPlayedRef.current = true;

      audio.addEventListener('ended', () => {
        setTimeout(() => {
          room.localParticipant.setMicrophoneEnabled(true).catch(err => console.warn('Mic enable failed:', err));
        }, 300);
      });
    }
  }, [agentState, room]);

  return (
    <>
      <AnimatePresence mode="wait">
        {agentState === "disconnected" ? (
          <motion.div
            key="disconnected"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="grid items-center justify-center h-full"
          >
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="flex flex-col items-center uppercase px-4 py-2 bg-white text-black rounded-md"
            >
            <span>エントリーワークの公開は終了いたしました。</span>
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="connected"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="grid place-items-center justify-center h-full"
          >
            <P5Visualizer />
            <div className="flex-1 w-full">
              {/* <TranscriptionView /> */}
            </div>
            <div className="w-full">
              <ControlBar onConnectButtonClicked={props.onConnectButtonClicked} />
            </div>
            <RoomAudioRenderer />
            {/* <NoAgentNotification state={agentState} /> */}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Memoized and callback-wrapped to prevent unnecessary re-creation
const P5Visualizer = dynamic(() => import('@/components/P5Visualizer'), {
  ssr: false,           // ← ここがポイント
  loading: () => null,  // 省略可：ローディング UI が要るなら書く
});

function ControlBar(props: { onConnectButtonClicked: () => void }) {
  const { state: agentState } = useVoiceAssistant();

  return (
    <div className="relative h-[60px]">
      <AnimatePresence>
        {agentState === "disconnected" && (
          <motion.button
            initial={{ opacity: 0, top: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 1, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="flex flex-col items-center uppercase px-4 py-2 bg-white text-black rounded-md"
            onClick={() => props.onConnectButtonClicked()}
          >
            <span>会話を始める</span>
            <span className="text-xs tracking-wide">音量を上げてからクリック</span>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {agentState !== "disconnected" && agentState !== "connecting" && (
          <motion.div
            initial={{ opacity: 0, top: "10px" }}
            animate={{ opacity: 1, top: 0 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 0.4, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="flex h-8 absolute left-1/2 -translate-x-1/2 justify-center"
          >
            <DisconnectButton>
              <CloseIcon />
            </DisconnectButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function onDeviceFailure(error: Error) {
  console.error(error);
  alert(
    "マイクへのアクセスがまだ許可されていないようです。ブラウザの設定で「マイクを許可」にしてから、もう一度ページを読み込んでみてください。"
  );
}















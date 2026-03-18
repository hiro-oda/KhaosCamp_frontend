"use client";

import { CloseIcon } from "@/components/CloseIcon";
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

  // PDFのアップロードとAPI処理の状態管理
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfResult, setPdfResult] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>(""); // 追加: 抽出したテキストを保存

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

  // PDFアップロード時の処理
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズ制限 (4.5MB)
    const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setPdfResult("エラー: ファイルサイズが大きすぎます。4.5MB以下のPDFを選択してください。");
      return;
    }

    setIsProcessingPdf(true);
    setPdfResult("");
    setExtractedText(""); // 新しいアップロード時にテキストをリセット

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (uploadResponse.status === 413) {
        throw new Error("ファイルサイズがVercelの上限(4.5MB)を超えています。");
      }

      if (!uploadResponse.ok) {
        const contentType = uploadResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "アップロードに失敗しました");
        } else {
          throw new Error(`サーバーエラー (${uploadResponse.status}): 処理に失敗しました`);
        }
      }

      const uploadData = await uploadResponse.json();
      console.log("File uploaded successfully:", uploadData);
      setPdfResult("PDFのアップロードが完了しました！ (File ID: " + uploadData.id + ")");
      
      // 抽出されたテキストをStateにセット
      if (uploadData.extractedText) {
        setExtractedText(uploadData.extractedText);
      }

    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error) {
        setPdfResult("リクエストに失敗しました: " + error.message);
      } else {
        setPdfResult("リクエストに失敗しました: 不明なエラーが発生しました");
      }
    } finally {
      setIsProcessingPdf(false);
    }
  };

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
            className="flex flex-col items-center justify-center h-full gap-8 w-full px-4"
          >
            <div className="flex flex-col items-center gap-4 p-6 border border-gray-700 rounded-xl bg-gray-900/50 w-full max-w-lg">
              <label className="text-white text-sm font-semibold">
                事前資料 (PDF) を読み込ませる
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                disabled={isProcessingPdf}
                className="text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white file:text-black hover:file:bg-gray-200 cursor-pointer disabled:opacity-50"
              />
              {isProcessingPdf && <p className="text-sm text-gray-400">テキスト抽出・アップロード中...</p>}
              {pdfResult && <p className="text-sm text-green-400 text-center break-all">{pdfResult}</p>}
              
              {/* 追加: 抽出したテキストを表示するエリア */}
              {extractedText && (
                <div className="w-full mt-2 p-3 bg-black/50 border border-gray-600 rounded-lg max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {extractedText}
                  </p>
                </div>
              )}
            </div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="flex flex-col items-center uppercase px-4 py-2 bg-white text-black rounded-md"
              onClick={() => props.onConnectButtonClicked()}
            >
            <span>会話を始める</span>
            <span className="text-xs tracking-wide">音量を上げてからクリック</span>
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
            </div>
            <div className="w-full">
              <ControlBar onConnectButtonClicked={props.onConnectButtonClicked} />
            </div>
            <RoomAudioRenderer />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const P5Visualizer = dynamic(() => import('@/components/P5Visualizer'), {
  ssr: false,
  loading: () => null,
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

// "use client";

// import { CloseIcon } from "@/components/CloseIcon";
// // import { NoAgentNotification } from "@/components/NoAgentNotification";
// // import TranscriptionView from "@/components/TranscriptionView";
// import dynamic from 'next/dynamic';
// import {
//   DisconnectButton,
//   RoomAudioRenderer,
//   RoomContext,
//   useVoiceAssistant,
// } from "@livekit/components-react";
// import { AnimatePresence, motion } from "framer-motion";
// import { Room, RoomEvent } from "livekit-client";
// import { useCallback, useEffect, useRef, useState, useContext} from "react";
// import type { ConnectionDetails } from "./api/connection-details/route";

// export default function Page() {
//   const [room] = useState(new Room());

//   const onConnectButtonClicked = useCallback(async () => {
//     const url = new URL(
//       process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details",
//       window.location.origin
//     );
//     const response = await fetch(url.toString());
//     const connectionDetailsData: ConnectionDetails = await response.json();

//     await room.connect(
//       connectionDetailsData.serverUrl,
//       connectionDetailsData.participantToken
//     );
//     await room.localParticipant.setMicrophoneEnabled(false);
//   }, [room]);

//   useEffect(() => {
//     room.on(RoomEvent.MediaDevicesError, onDeviceFailure);
//     return () => {
//       room.off(RoomEvent.MediaDevicesError, onDeviceFailure);
//     };
//   }, [room]);

//   return (
//     <main data-lk-theme="default" className="h-full grid content-center bg-black">
//       <RoomContext.Provider value={room}>
//       <div className="lk-room-container w-screen h-screen overflow-hidden">
//           <SimpleVoiceAssistant onConnectButtonClicked={onConnectButtonClicked} />
//         </div>
//       </RoomContext.Provider>
//     </main>
//   );
// }


// function SimpleVoiceAssistant(props: { onConnectButtonClicked: () => void }) {
//   const { state: agentState } = useVoiceAssistant();
//   const room = useContext(RoomContext)!;
//   const hasPlayedRef = useRef(false);

//   useEffect(() => {
//     if (agentState !== "disconnected" && !hasPlayedRef.current) {
//       room.localParticipant.setMicrophoneEnabled(false).catch(err => console.warn('Mic disable failed:', err));
//       const audio = new Audio('/initial_speech.wav');
//       audio.play().catch((err) => console.warn('Audio playback failed:', err));
//       hasPlayedRef.current = true;

//       audio.addEventListener('ended', () => {
//         setTimeout(() => {
//           room.localParticipant.setMicrophoneEnabled(true).catch(err => console.warn('Mic enable failed:', err));
//         }, 300);
//       });
//     }
//   }, [agentState, room]);

//   return (
//     <>
//       <AnimatePresence mode="wait">
//         {agentState === "disconnected" ? (
//           <motion.div
//             key="disconnected"
//             initial={{ opacity: 0, scale: 0.95 }}
//             animate={{ opacity: 1, scale: 1 }}
//             exit={{ opacity: 0, scale: 0.95 }}
//             transition={{ duration: 0.3, ease: [0.09, 1.04, 0.245, 1.055] }}
//             className="grid items-center justify-center h-full"
//           >
//             <motion.button
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               transition={{ duration: 0.3, delay: 0.1 }}
//               className="flex flex-col items-center uppercase px-4 py-2 bg-white text-black rounded-md"
//               onClick={() => props.onConnectButtonClicked()}
//             >
//             <span>会話を始める</span>
//             <span className="text-xs tracking-wide">音量を上げてからクリック</span>
//             </motion.button>
//           </motion.div>
//         ) : (
//           <motion.div
//             key="connected"
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: -20 }}
//             transition={{ duration: 0.3, ease: [0.09, 1.04, 0.245, 1.055] }}
//             className="grid place-items-center justify-center h-full"
//           >
//             <P5Visualizer />
//             <div className="flex-1 w-full">
//               {/* <TranscriptionView /> */}
//             </div>
//             <div className="w-full">
//               <ControlBar onConnectButtonClicked={props.onConnectButtonClicked} />
//             </div>
//             <RoomAudioRenderer />
//             {/* <NoAgentNotification state={agentState} /> */}
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </>
//   );
// }

// // Memoized and callback-wrapped to prevent unnecessary re-creation
// const P5Visualizer = dynamic(() => import('@/components/P5Visualizer'), {
//   ssr: false,           // ← ここがポイント
//   loading: () => null,  // 省略可：ローディング UI が要るなら書く
// });

// function ControlBar(props: { onConnectButtonClicked: () => void }) {
//   const { state: agentState } = useVoiceAssistant();

//   return (
//     <div className="relative h-[60px]">
//       <AnimatePresence>
//         {agentState === "disconnected" && (
//           <motion.button
//             initial={{ opacity: 0, top: 0 }}
//             animate={{ opacity: 1 }}
//             exit={{ opacity: 0, top: "-10px" }}
//             transition={{ duration: 1, ease: [0.09, 1.04, 0.245, 1.055] }}
//             className="flex flex-col items-center uppercase px-4 py-2 bg-white text-black rounded-md"
//             onClick={() => props.onConnectButtonClicked()}
//           >
//             <span>会話を始める</span>
//             <span className="text-xs tracking-wide">音量を上げてからクリック</span>
//           </motion.button>
//         )}
//       </AnimatePresence>
//       <AnimatePresence>
//         {agentState !== "disconnected" && agentState !== "connecting" && (
//           <motion.div
//             initial={{ opacity: 0, top: "10px" }}
//             animate={{ opacity: 1, top: 0 }}
//             exit={{ opacity: 0, top: "-10px" }}
//             transition={{ duration: 0.4, ease: [0.09, 1.04, 0.245, 1.055] }}
//             className="flex h-8 absolute left-1/2 -translate-x-1/2 justify-center"
//           >
//             <DisconnectButton>
//               <CloseIcon />
//             </DisconnectButton>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }

// function onDeviceFailure(error: Error) {
//   console.error(error);
//   alert(
//     "マイクへのアクセスがまだ許可されていないようです。ブラウザの設定で「マイクを許可」にしてから、もう一度ページを読み込んでみてください。"
//   );
// }














"use client";

import { CloseIcon } from "@/components/CloseIcon";
// import { NoAgentNotification } from "@/components/NoAgentNotification";
// import TranscriptionView from "@/components/TranscriptionView";
import {
  DisconnectButton,
  RoomAudioRenderer,
  RoomContext,
  useVoiceAssistant,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { Room, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState, useContext, memo } from "react";
import {ReactP5Wrapper} from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';
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
              className="uppercase px-4 py-2 bg-white text-black rounded-md"
              onClick={() => props.onConnectButtonClicked()}
            >
              会話を始める
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
const P5Visualizer = memo(function P5Visualizer() {
  const sketch = useCallback<Sketch>((s) => {
    // Parameters for pendulums
    const baseR1 = 150;
    const baseR2 = 150;
    let r1 = baseR1, r2 = baseR2;
    const N = 30;
    const dt = 1.0;
    const DAMPING = 0.9997;

    // Pendulum state arrays
    const th1 = [];
    const th2 = [];
    const w1 = [];
    const w2 = [];
    const px2 = [];
    const py2 = [];

    // Buffer and center
    let cx, cy, buffer;

    // Audio analysis variables
    let audioContext, analyser, dataArray;

    // Utility: compute RMS volume
    function getVolume() {
      if (!analyser) return 0;
      analyser.getFloatTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      return Math.sqrt(sum / dataArray.length);
    }

    s.setup = () => {
      s.createCanvas(s.windowWidth, s.windowHeight);
      s.background(0);
      cx = s.width / 2;
      cy = s.height / 2.3;
      buffer = s.createGraphics(s.width, s.height);
      buffer.background(0);
      buffer.translate(cx, cy);
      s.colorMode(s.HSB, 360, 100, 100);
      buffer.colorMode(s.HSB, 360, 100, 100);

      // Initialize pendulum states
      for (let i = 0; i < N; i++) {
        th1[i] = s.PI / 2 + s.random(-0.001, 0.001);
        th2[i] = s.PI / 2 + s.random(-0.001, 0.001);
        w1[i] = 0;
        w2[i] = 0;
        px2[i] = null;
        py2[i] = null;
      }

      // Set up audio input via Web Audio API
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          audioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(stream);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          dataArray = new Float32Array(analyser.fftSize);
          source.connect(analyser);
        })
        .catch((err) => {
          console.error('Microphone access error:', err);
        });
    };

    // Physics derivative and RK4 integrator
    function deriv(t1, t2, om1, om2, r1, r2) {
      const m1 = 10, m2 = 10, g = 0.2;
      const delta = t2 - t1;
      const den1 = (m1 + m2) * r1 - m2 * r1 * Math.cos(delta) * Math.cos(delta);
      const den2 = (r2 / r1) * den1;
      const om1dot =
        (m2 * r1 * om1 * om1 * Math.sin(delta) * Math.cos(delta) +
         m2 * g * Math.sin(t2) * Math.cos(delta) +
         m2 * r2 * om2 * om2 * Math.sin(delta) -
         (m1 + m2) * g * Math.sin(t1)) / den1;
      const om2dot =
        (-m2 * r2 * om2 * om2 * Math.sin(delta) * Math.cos(delta) +
         (m1 + m2) * (g * Math.sin(t1) * Math.cos(delta) - r1 * om1 * om1 * Math.sin(delta) - g * Math.sin(t2))) /
        den2;
      return [om1, om2, om1dot, om2dot];
    }

    function rk4(state, dt, r1, r2) {
      const k1 = deriv(state[0], state[1], state[2], state[3], r1, r2);
      const k2 = deriv(
        state[0] + k1[0] * dt * 0.5,
        state[1] + k1[1] * dt * 0.5,
        state[2] + k1[2] * dt * 0.5,
        state[3] + k1[3] * dt * 0.5,
        r1, r2
      );
      const k3 = deriv(
        state[0] + k2[0] * dt * 0.5,
        state[1] + k2[1] * dt * 0.5,
        state[2] + k2[2] * dt * 0.5,
        state[3] + k2[3] * dt * 0.5,
        r1, r2
      );
      const k4 = deriv(
        state[0] + k3[0] * dt,
        state[1] + k3[1] * dt,
        state[2] + k3[2] * dt,
        state[3] + k3[3] * dt,
        r1, r2
      );
      return [
        state[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
        state[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
        state[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
        state[3] + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
      ];
    }

    s.draw = () => {
      // Compute current volume and map to length offset
      const volume = getVolume();
      // Map volume (0 - ~0.05) to additional length (0 - 300)
      const lengthOffset = s.map(volume, 0, 0.05, 0, 50);
      r1 = baseR1 + lengthOffset;
      r2 = baseR2 + lengthOffset;

      s.background(0);
      s.image(buffer, 0, 0);
      buffer.push();
      buffer.strokeWeight(0.5);

      for (let i = 0; i < N; i++) {
        const hueBase = (s.frameCount * 0.2 + (360 / N) * i) % 360;
        buffer.stroke(hueBase, 100, 100);
        const next = rk4([th1[i], th2[i], w1[i], w2[i]], dt, r1, r2);
        th1[i] = next[0];
        th2[i] = next[1];
        w1[i] = next[2] * DAMPING;
        w2[i] = next[3] * DAMPING;
        const x1 = r1 * s.sin(th1[i]), y1 = r1 * s.cos(th1[i]);
        const x2 = x1 + r2 * s.sin(th2[i]), y2 = y1 + r2 * s.cos(th2[i]);
        const phi = i * s.TWO_PI / N;
        const xr = x2 * s.cos(phi) - y2 * s.sin(phi);
        const yr = x2 * s.sin(phi) + y2 * s.cos(phi);
        if (px2[i] !== null) {
          buffer.line(px2[i], py2[i], xr, yr);
        }
        px2[i] = xr;
        py2[i] = yr;
      }

      buffer.pop();
      s.push();
      s.noStroke();
      for (let i = 0; i < N; i++) {
        const hueBase = (s.frameCount * 0.2 + (360 / N) * i) % 360;
        s.fill(hueBase, 100, 100);
        const x1 = r1 * s.sin(th1[i]);
        const y1 = r1 * s.cos(th1[i]);
        const x2 = x1 + r2 * s.sin(th2[i]);
        const y2 = y1 + r2 * s.cos(th2[i]);
        const phi = i * s.TWO_PI / N;
        const xr = x2 * s.cos(phi) - y2 * s.sin(phi);
        const yr = x2 * s.sin(phi) + y2 * s.cos(phi);
        s.ellipse(s.width/2 + xr, s.height/2.3 + yr, 8, 8);
      }
    };

    s.windowResized = () => {
      s.resizeCanvas(s.windowWidth, s.windowHeight);
      cx = s.width / 2;
      cy = s.height / 2.3;
      buffer.resizeCanvas(s.windowWidth, s.windowHeight);
      buffer.resetMatrix();
      buffer.background(0);
      buffer.translate(cx, cy);
    };
  }, []);

  return (
    <div className="w-full h-full bg-black">
      <ReactP5Wrapper sketch={sketch} />
    </div>
  );
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
            className="uppercase absolute left-1/2 -translate-x-1/2 px-4 py-2 bg-white text-black rounded-md"
            onClick={() => props.onConnectButtonClicked()}
          >
            会話を始める
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















'use client';

import { memo, useCallback } from 'react';
import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';

/* ★ ここに元の sketch コードをそのまま置く ★ */
export default memo(function P5Visualizer() {
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
          audioContext = new AudioContext();
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

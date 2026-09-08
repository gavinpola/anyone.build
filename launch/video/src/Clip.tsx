import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/** A segment of recorded footage: which file, which seconds of it, at what speed, framed how. */
export type Segment = {
  src: string; // file name under public/ (the recorder's .webm, copied there by cut.mjs)
  from: number; // seconds into the source
  to: number;
  speed?: number; // 1 = real time; 8 = the pipeline wait
  /** a zoom on a point of the source, 0..1 of width/height; scale 1 = none */
  zoom?: { x: number; y: number; scale: number };
  /** a card between segments instead of footage */
  card?: string;
};

export type Caption = { from: number; to: number; text: string };

export type ClipSpec = {
  id: string;
  width: number;
  height: number;
  duration: number; // seconds
  hook: string; // on-screen text for the first frames
  segments: Segment[];
  captions: Caption[];
  audio?: string | null; // file name under public/, the voice
  silent?: boolean; // the captions-only master
};

const INK = "#f4efe3";
const ACCENT = "#ffd84d";
const BG = "#0e0c09";

/** Where a segment starts on the timeline, in seconds, given the ones before it. */
function timeline(segments: Segment[]): { start: number; length: number }[] {
  let t = 0;
  return segments.map((s) => {
    const length = s.card ? s.to - s.from : (s.to - s.from) / (s.speed ?? 1);
    const out = { start: t, length };
    t += length;
    return out;
  });
}

export const Clip: React.FC<ClipSpec> = (spec) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const vertical = height > width;
  const slots = timeline(spec.segments);
  const hookUntil = 1.6;
  const hookOpacity = interpolate(t, [0, 0.25, hookUntil - 0.3, hookUntil], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hookY = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "Geist, Inter, -apple-system, Helvetica, Arial, sans-serif", color: INK }}>
      {spec.segments.map((s, i) => {
        const { start, length } = slots[i]!;
        const fromF = Math.round(start * fps);
        const durF = Math.max(1, Math.round(length * fps));
        if (s.card) {
          return (
            <Sequence key={i} from={fromF} durationInFrames={durF}>
              <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: vertical ? 90 : 160 }}>
                <div style={{ fontSize: vertical ? 74 : 72, lineHeight: 1.15, textAlign: "center", letterSpacing: -1 }}>{s.card}</div>
              </AbsoluteFill>
            </Sequence>
          );
        }
        const z = s.zoom?.scale ?? 1;
        const ox = s.zoom ? (0.5 - s.zoom.x) * 100 * (z - 1) : 0;
        const oy = s.zoom ? (0.5 - s.zoom.y) * 100 * (z - 1) : 0;
        // a desktop recording on a vertical canvas sits in the middle band, at full width; the captions live below it
        const srcIsWide = /desktop/.test(s.src);
        const bandH = vertical && srcIsWide ? Math.round((width * 9) / 16) : height;
        return (
          <Sequence key={i} from={fromF} durationInFrames={durF}>
            <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
              <div style={{ width, height: bandH, overflow: "hidden", position: "relative", background: "#000" }}>
                <OffthreadVideo
                  src={staticFile(s.src)}
                  startFrom={Math.round(s.from * fps)}
                  endAt={Math.round(s.to * fps)}
                  playbackRate={s.speed ?? 1}
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translate(${ox}%, ${oy}%) scale(${z})`, transformOrigin: "center" }}
                />
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* the hook: on screen in frame one, gone by the time the first beat lands */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: vertical ? "flex-start" : "flex-end", padding: vertical ? "160px 70px" : "0 120px 110px", pointerEvents: "none" }}>
        <div
          style={{
            opacity: hookOpacity,
            transform: `translateY(${(1 - hookY) * 30}px)`,
            background: "rgba(14,12,9,0.86)",
            border: `2px solid ${ACCENT}`,
            padding: vertical ? "26px 34px" : "20px 30px",
            fontSize: vertical ? 64 : 54,
            lineHeight: 1.12,
            textAlign: "center",
            maxWidth: vertical ? width - 120 : 1100,
            letterSpacing: -0.5,
          }}
        >
          {spec.hook}
        </div>
      </AbsoluteFill>

      {/* captions: one line at a time, where a phone thumb isn't */}
      {spec.captions.map((c, i) => {
        if (t < c.from || t >= c.to) return null;
        const inF = interpolate(t, [c.from, c.from + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <AbsoluteFill key={i} style={{ alignItems: "center", justifyContent: "flex-end", padding: vertical ? "0 60px 330px" : "0 140px 70px", pointerEvents: "none" }}>
            <div
              style={{
                opacity: inF,
                background: "rgba(14,12,9,0.82)",
                color: INK,
                padding: vertical ? "18px 28px" : "14px 22px",
                fontSize: vertical ? 50 : 40,
                lineHeight: 1.2,
                textAlign: "center",
                maxWidth: vertical ? width - 120 : 1200,
              }}
            >
              {c.text}
            </div>
          </AbsoluteFill>
        );
      })}

      {/* the brand, bottom right, always */}
      <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "flex-end", padding: vertical ? "0 60px 90px" : "0 60px 40px", pointerEvents: "none" }}>
        <div style={{ fontSize: vertical ? 40 : 30, letterSpacing: 0.5 }}>
          everyones<span style={{ color: ACCENT }}>.</span>lol
        </div>
      </AbsoluteFill>

      {spec.audio && !spec.silent ? <Audio src={staticFile(spec.audio)} /> : null}
    </AbsoluteFill>
  );
};

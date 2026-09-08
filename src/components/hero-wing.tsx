"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./hero-wing.module.css";

type Point = [number, number];
type Plane = { path: string; delay: number; duration: number; startScale: number };
type Flight = { scene: HTMLElement; planes: Plane[]; width: number; height: number; reduced: boolean };

// A closed Catmull-Rom curve gives every turn a continuous tangent, including
// where the flight returns to the fold it started from.
function loopPath(points: Point[]) {
  const count = points.length;
  const n = (value: number) => Math.round(value * 10) / 10;
  let path = `M ${n(points[0][0])} ${n(points[0][1])}`;
  for (let i = 0; i < count; i++) {
    const a = points[(i - 1 + count) % count], b = points[i];
    const c = points[(i + 1) % count], d = points[(i + 2) % count];
    path += ` C ${n(b[0] + (c[0] - a[0]) / 6)} ${n(b[1] + (c[1] - a[1]) / 6)}, ${n(c[0] - (d[0] - b[0]) / 6)} ${n(c[1] - (d[1] - b[1]) / 6)}, ${n(c[0])} ${n(c[1])}`;
  }
  return path;
}

export function HeroWing() {
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function launch() {
    if (busy.current || !button.current) return;
    const scene = button.current.closest<HTMLElement>("[data-plane-scene]");
    if (!scene) return;
    busy.current = true;
    const rect = button.current.getBoundingClientRect();
    const w = window.innerWidth, h = window.innerHeight;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // These centers and widths follow the three folds in the Blender artwork.
    const folds = [[.485, .318, .72], [.45, .486, .57], [.418, .653, .44]];
    const planes = folds.map(([fx, fy, fw], i) => {
      const x = rect.left + rect.width * fx, y = rect.top + rect.height * fy;
      const routes: Point[][] = [
        [[x,y], [x+w*.1,y-18], [w*.81,h*.15], [w*.43,h*.18], [w*.12,h*.32], [w*.26,h*.54], [x-w*.24,y+65], [x-w*.1,y+5]],
        [[x,y], [x+w*.1,y-12], [w*.96,h*.52], [w*.64,h*.79], [w*.14,h*.62], [w*.19,h*.33], [x-w*.28,y-40], [x-w*.1,y+5]],
        [[x,y], [x+w*.1,y-12], [w*.77,h*.29], [w*.35,h*.38], [w*.33,h*.7], [w*.69,h*.81], [w*.92,h*.48], [x-w*.12,y+6]],
      ];
      return { path: loopPath(routes[i]), delay: i * 180, duration: 5400 + i * 180, startScale: rect.width * fw / (w <= 600 ? i === 0 ? 64 : 88 : i === 0 ? 88 : 126) };
    });
    setFlight({ scene, planes, width: w, height: h, reduced });
    timer.current = setTimeout(() => { setFlight(null); busy.current = false; timer.current = null; }, reduced ? 600 : 6450);
  }

  function timing(index: number): CSSProperties {
    const plane = flight!.planes[index];
    return { "--delay": `${plane.delay}ms`, "--duration": `${plane.duration}ms`, "--start-scale": plane.startScale } as CSSProperties;
  }

  function layer(indices: number[], name: "behind" | "front") {
    return <div className={`${styles.layer} ${name === "behind" ? styles.behind : styles.inFront}`} aria-hidden="true" data-plane-layer={name}>
      <svg className={styles.trails} viewBox={`0 0 ${flight!.width} ${flight!.height}`} preserveAspectRatio="none">
        {indices.map(index => <g key={index} style={timing(index)}>
          <path className={`${styles.trail} ${styles.trailGlow}`} d={flight!.planes[index].path} pathLength={1000} />
          <path className={styles.trail} d={flight!.planes[index].path} pathLength={1000} />
        </g>)}
      </svg>
      {indices.map(index => <span key={index} className={`${styles.flight} ${index === 0 ? styles.distant : styles.near}`} data-paper-plane={index}
        style={{ ...timing(index), offsetPath: `path('${flight!.planes[index].path}')` }}>
        <span className={styles.paper}><span className={styles.upper} /><span className={styles.lower} /><span className={styles.keel} /></span>
      </span>)}
    </div>;
  }

  return <>
    <button ref={button} type="button" className={styles.button} onClick={launch} disabled={!!flight} aria-label="Send the wing flying as paper airplanes" aria-busy={!!flight} data-flying={!!flight && !flight.reduced} data-fold={!!flight?.reduced}>
      <Image className={styles.mark} src="/brand/wing-sculptural.webp" alt="" width={640} height={640} sizes="(max-width: 600px) 110px, (max-width: 1100px) 35vw, 430px" preload />
      {flight && !flight.reduced ? flight.planes.map((_, i) => <Image key={i} className={styles.fold} style={{ ...timing(i), clipPath: `inset(${i === 0 ? 22 : i === 1 ? 41 : 58}% 0 ${i === 0 ? 59 : i === 1 ? 42 : 25}% 0)` }} src="/brand/wing-sculptural.webp" alt="" width={640} height={640} sizes="(max-width: 600px) 110px, 430px" />) : null}
    </button>
    <span className="sr-only" role="status">{flight ? "A little advice, taking flight." : ""}</span>
    {flight && !flight.reduced ? createPortal(<>{layer([0], "behind")}{layer([1,2], "front")}</>, flight.scene) : null}
  </>;
}

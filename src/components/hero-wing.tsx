"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { animatePaperFlight } from "./paper-flight";
import styles from "./hero-wing.module.css";

type Flight = { scene: HTMLElement; reduced: boolean };

export function HeroWing() {
  const button = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const folds = useRef<(HTMLImageElement | null)[]>([]);
  const busy = useRef(false);
  const played = useRef(false);
  const [flight, setFlight] = useState<Flight | null>(null);

  const launch = useCallback(() => {
    if (busy.current || !button.current) return;
    const scene = button.current.closest<HTMLElement>("[data-plane-scene]");
    if (!scene) return;
    busy.current = true;
    played.current = true;
    setFlight({ scene, reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    let cancelled = false, ready = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const firstFlight = () => {
      if (!ready || cancelled || played.current || document.hidden || motion.matches) return;
      const rect = button.current?.getBoundingClientRect();
      if (rect && rect.bottom > 0 && rect.top < window.innerHeight) launch();
    };
    // Give the complete logo a brief moment on screen before it takes flight.
    // Fonts and the artwork are ready first so its return coordinates stay put.
    const artwork = button.current?.querySelector("img");
    Promise.all([document.fonts.ready, artwork?.decode().catch(() => {})]).then(() => {
      if (!cancelled) timer = setTimeout(() => { ready = true; firstFlight(); }, 850);
    });
    document.addEventListener("visibilitychange", firstFlight);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", firstFlight);
    };
  }, [launch]);

  useEffect(() => {
    if (!flight || !button.current) return;
    const finish = () => { busy.current = false; setFlight(null); };
    if (flight.reduced) {
      const timer = setTimeout(finish, 450);
      return () => clearTimeout(timer);
    }
    if (!back.current || !front.current) return;
    const stop = animatePaperFlight([back.current, front.current], folds.current, button.current.getBoundingClientRect(), finish);
    // A resized or scrolled page moves the destination. Restore the mark rather
    // than returning to a position where it no longer lives.
    window.addEventListener("resize", finish);
    window.addEventListener("scroll", finish, { passive: true });
    const hide = () => { if (document.hidden) finish(); };
    document.addEventListener("visibilitychange", hide);
    return () => {
      stop();
      window.removeEventListener("resize", finish);
      window.removeEventListener("scroll", finish);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [flight]);

  return <>
    <button ref={button} type="button" className={styles.button} onClick={launch} disabled={!!flight} aria-label="Send the wing flying as paper airplanes" aria-busy={!!flight} data-flying={!!flight && !flight.reduced} data-fold={!!flight?.reduced}>
      <Image className={styles.mark} src="/brand/wing-sculptural.webp" alt="" width={640} height={640} sizes="(max-width: 600px) 110px, (max-width: 1100px) 35vw, 430px" preload />
      {flight && !flight.reduced ? [0, 1, 2].map(i => <Image key={i} ref={node => { folds.current[i] = node; }} className={styles.fold} style={{ clipPath: `inset(${i === 0 ? 22 : i === 1 ? 41 : 58}% 0 ${i === 0 ? 59 : i === 1 ? 42 : 25}% 0)` }} src="/brand/wing-sculptural.webp" alt="" width={640} height={640} sizes="(max-width: 600px) 110px, 430px" />) : null}
    </button>
    <span className="sr-only" role="status">{flight ? "A little advice, taking flight." : ""}</span>
    {flight && !flight.reduced ? createPortal(<>
      <canvas ref={back} className={`${styles.layer} ${styles.behind}`} aria-hidden="true" data-plane-layer="behind" />
      <canvas ref={front} className={`${styles.layer} ${styles.inFront}`} aria-hidden="true" data-plane-layer="front" />
    </>, flight.scene) : null}
  </>;
}

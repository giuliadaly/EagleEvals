"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./perched-eagle.module.css";

const SPRITE = "/brand/eagle-stretch.webp";
const FRAME_COUNT = 48;
const DURATION = 2000;

export function PerchedEagle() {
  const [playing, setPlaying] = useState(false);
  const sprite = useRef<HTMLSpanElement>(null);
  const frame = useRef<number | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const texture = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  async function stretch() {
    if (busy.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    busy.current = true;
    try {
      // Keep the animation off the initial page load. Decode once, on demand.
      if (!texture.current) {
        texture.current = new window.Image();
        texture.current.src = SPRITE;
      }
      await texture.current.decode();
      if (!mounted.current || !sprite.current) return;
      sprite.current.style.backgroundImage = `url("${SPRITE}")`;
      sprite.current.style.backgroundPosition = "0% 0%";
      setPlaying(true);
      const start = performance.now();
      function tick(now: number) {
        if (!mounted.current || !sprite.current) return;
        if (now - start >= DURATION) {
          setPlaying(false);
          busy.current = false;
          frame.current = null;
          return;
        }
        const index = Math.min(FRAME_COUNT - 1, Math.floor((now - start) / DURATION * FRAME_COUNT));
        sprite.current.style.backgroundPosition = `${(index % 8) / 7 * 100}% ${Math.floor(index / 8) / 5 * 100}%`;
        frame.current = requestAnimationFrame(tick);
      }
      frame.current = requestAnimationFrame(tick);
    } catch {
      // A decorative animation should never interrupt browsing.
      texture.current = null;
      busy.current = false;
    }
  }

  return (
    <button type="button" className={styles.eagle} onClick={stretch} data-playing={playing} aria-label="Give the eagle a stretch" aria-busy={playing}>
      <Image className={styles.perched} src="/brand/eagle-perched.webp" alt="" width={384} height={384} unoptimized />
      <span className={styles.sprite} ref={sprite} aria-hidden="true" />
    </button>
  );
}

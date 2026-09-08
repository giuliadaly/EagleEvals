"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sharePage, SITE_ORIGIN } from "@/data/sharing";
import styles from "./share-page.module.css";

export function SharePage({ path, title }: { path: string; title: string }) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const url = `${SITE_ORIGIN}${path}`;
  useEffect(() => { if (status === "manual") { input.current?.focus(); input.current?.select(); } }, [status]);

  async function share() {
    setPending(true);
    setStatus("");
    const result = await sharePage(title, url, navigator);
    setStatus(result);
    setPending(false);
  }

  return <div className={styles.share}>
    <button type="button" className={styles.button} onClick={share} disabled={pending} aria-label={`Share ${title}`}>
      <span aria-hidden="true">↗</span> Share
    </button>
    <span className={styles.status} role="status">{status === "copied" ? "Link copied" : status === "shared" ? "Link shared" : ""}</span>
    {status === "manual" ? <div className={styles.manual}><label htmlFor={inputId}>Copy this link to share</label><input id={inputId} ref={input} value={url} readOnly onFocus={event => event.currentTarget.select()} /></div> : null}
  </div>;
}

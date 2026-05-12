"use client";

import { useEffect, useRef } from "react";

interface Props {
  articleId: string;
  slug: string;
}

export function ArticleReadTracker({ articleId, slug }: Props) {
  const startedAt = useRef<number>(Date.now());
  const milestonesReached = useRef<Set<number>>(new Set());
  const completedFired = useRef<boolean>(false);

  useEffect(() => {
    function send(event: string, payload: Record<string, unknown> = {}) {
      try {
        const body = JSON.stringify({ event, articleId, slug, ...payload });
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: "application/json" });
          navigator.sendBeacon("/api/articles/track", blob);
        } else {
          fetch("/api/articles/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    }

    send("view_start");

    function onScroll() {
      const doc = document.documentElement;
      const scrolled = window.scrollY + window.innerHeight;
      const total = doc.scrollHeight;
      if (total <= 0) return;
      const pct = Math.min(100, Math.round((scrolled / total) * 100));

      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !milestonesReached.current.has(m)) {
          milestonesReached.current.add(m);
          send("scroll_milestone", { milestone: m });
        }
      }
      if (pct >= 90 && !completedFired.current) {
        completedFired.current = true;
        const seconds = Math.round((Date.now() - startedAt.current) / 1000);
        send("read_complete", { seconds });
      }
    }

    function onUnload() {
      const seconds = Math.round((Date.now() - startedAt.current) / 1000);
      send("view_end", { seconds });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [articleId, slug]);

  return null;
}

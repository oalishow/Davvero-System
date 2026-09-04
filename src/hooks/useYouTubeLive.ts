import { useState, useEffect, useCallback, useRef } from "react";
import { db, appId } from "../lib/firebase";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

export interface YouTubeLiveStatus {
  isLive: boolean;
  channel: string;
  channelUrl: string;
  liveUrl: string;
  watchUrl: string | null;
  videoId: string | null;
  title: string | null;
  checkedAt: string | null;
  cached?: boolean;
  source?: string;
}

const DEFAULT_CHANNEL = "@fajopademarilia";
const DEFAULT_CHANNEL_URL = `https://www.youtube.com/${DEFAULT_CHANNEL}`;
const DEFAULT_LIVE_URL = `https://www.youtube.com/${DEFAULT_CHANNEL}/live`;
const FIRESTORE_LIVE_DOC = `artifacts/${appId}/public/data/system_live_status/youtube`;

export function useYouTubeLive() {
  const [status, setStatus] = useState<YouTubeLiveStatus>({
    isLive: false,
    channel: DEFAULT_CHANNEL,
    channelUrl: DEFAULT_CHANNEL_URL,
    liveUrl: DEFAULT_LIVE_URL,
    watchUrl: null,
    videoId: null,
    title: null,
    checkedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const lastCheckTimeRef = useRef<number>(0);

  // Helper to parse HTML from YouTube /live page
  const parseYouTubeHtml = (html: string): { isLive: boolean; videoId: string | null; title: string | null } => {
    const hasLiveNow = html.includes('"isLiveNow":true');
    const hasLiveStatus = html.includes('"status":"LIVE"');
    const hasLiveBroadcast =
      html.includes('"isLive":true') &&
      !html.includes("LIVE_STREAM_OFFLINE") &&
      !html.includes('"status":"OFFLINE"');
    const isLive = Boolean(hasLiveNow || hasLiveStatus || hasLiveBroadcast);

    const videoIdMatch =
      html.match(/"externalVideoId":"([^"]+)"/) || html.match(/"videoId":"([^"]+)"/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    let title: string | null = null;
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      title = titleMatch[1]
        .replace(/ - YouTube$/, "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
    }

    return { isLive, videoId, title };
  };

  // Helper to fetch through CORS proxies if running on static hosts like Netlify without backend
  const fetchThroughProxies = async (targetUrl: string): Promise<string | null> => {
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    ];

    for (const proxyUrl of proxies) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        const res = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 500 && (text.includes("YouTube") || text.includes("ytInitialPlayerResponse") || text.includes("videoId"))) {
            return text;
          }
        }
      } catch (err) {
        // Try next proxy
      }
    }
    return null;
  };

  const checkLiveStatus = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheckTimeRef.current < 10000) {
      return;
    }
    lastCheckTimeRef.current = now;

    setIsChecking(true);
    let resolvedData: YouTubeLiveStatus | null = null;

    // STEP 1: Try local API or Netlify function endpoint
    try {
      const res = await fetch(`/api/youtube/live-status?channel=${DEFAULT_CHANNEL}${force ? "&force=true" : ""}`, {
        headers: { "Cache-Control": "no-cache", "Accept": "application/json" },
      });

      const contentType = res.headers.get("content-type") || "";
      // Only proceed if it is actually JSON and not an HTML SPA fallback (which happens on static Netlify deploys)
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data && typeof data.isLive === "boolean") {
          resolvedData = {
            ...data,
            source: data.source || "api",
          };
        }
      }
    } catch (err) {
      console.warn("[YouTube Live] /api/youtube/live-status inacessível, tentando fallback:", err);
    }

    // STEP 2: If endpoint didn't provide JSON (e.g. Netlify static fallback with HTML), try client CORS proxies
    if (!resolvedData) {
      try {
        const html = await fetchThroughProxies(DEFAULT_LIVE_URL);
        if (html) {
          const { isLive, videoId, title } = parseYouTubeHtml(html);
          resolvedData = {
            isLive,
            channel: DEFAULT_CHANNEL,
            channelUrl: DEFAULT_CHANNEL_URL,
            liveUrl: DEFAULT_LIVE_URL,
            watchUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : DEFAULT_LIVE_URL,
            videoId,
            title: isLive ? title : null,
            checkedAt: new Date().toISOString(),
            source: "client-proxy",
          };
        }
      } catch (proxyErr) {
        console.warn("[YouTube Live] Falha nos proxies clientes:", proxyErr);
      }
    }

    // STEP 3: Check Firestore Cloud sync if still unresolved
    if (!resolvedData && db) {
      try {
        const liveDocRef = doc(db, FIRESTORE_LIVE_DOC);
        const snap = await getDoc(liveDocRef);
        if (snap.exists()) {
          const cloudData = snap.data() as YouTubeLiveStatus;
          if (cloudData && typeof cloudData.isLive === "boolean") {
            resolvedData = {
              ...cloudData,
              source: "firestore-sync",
            };
          }
        }
      } catch (fsErr) {
        // Silent fallback
      }
    }

    // STEP 4: Apply resolved status & sync to Firestore if live detected
    if (resolvedData) {
      setStatus(resolvedData);

      // Save live status to Firestore to share across all users & Netlify clients
      if (db && resolvedData.isLive) {
        try {
          const liveDocRef = doc(db, FIRESTORE_LIVE_DOC);
          setDoc(liveDocRef, resolvedData, { merge: true }).catch(() => {});
        } catch (_) {}
      }
    }

    setLoading(false);
    setIsChecking(false);
  }, []);

  // Subscribe to Firestore live status for real-time sync across all devices
  useEffect(() => {
    if (!db) return;
    try {
      const liveDocRef = doc(db, FIRESTORE_LIVE_DOC);
      const unsub = onSnapshot(
        liveDocRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as YouTubeLiveStatus;
            if (data && typeof data.isLive === "boolean") {
              // If cloud says live within the last 15 minutes, update status immediately
              const checkedAt = data.checkedAt ? new Date(data.checkedAt).getTime() : 0;
              const isRecent = Date.now() - checkedAt < 15 * 60 * 1000;
              if (data.isLive && isRecent) {
                setStatus((prev) => ({
                  ...prev,
                  ...data,
                  source: "firestore-realtime",
                }));
              }
            }
          }
        },
        () => {}
      );
      return () => unsub();
    } catch (_) {}
  }, []);

  useEffect(() => {
    checkLiveStatus(false);

    // Periodic check every 60s
    const interval = setInterval(() => {
      checkLiveStatus(false);
    }, 60000);

    // Recheck on tab focus
    const onFocus = () => {
      checkLiveStatus(false);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkLiveStatus]);

  return {
    ...status,
    loading,
    isChecking,
    checkLiveStatus,
  };
}

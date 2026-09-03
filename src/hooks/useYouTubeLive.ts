import { useState, useEffect, useCallback, useRef } from "react";

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
}

export function useYouTubeLive() {
  const [status, setStatus] = useState<YouTubeLiveStatus>({
    isLive: false,
    channel: "@fajopademarilia",
    channelUrl: "https://www.youtube.com/@fajopademarilia",
    liveUrl: "https://www.youtube.com/@fajopademarilia/live",
    watchUrl: null,
    videoId: null,
    title: null,
    checkedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const lastCheckTimeRef = useRef<number>(0);

  const checkLiveStatus = useCallback(async (force = false) => {
    // Avoid spamming requests within 10 seconds unless forced
    const now = Date.now();
    if (!force && now - lastCheckTimeRef.current < 10000) {
      return;
    }
    lastCheckTimeRef.current = now;

    setIsChecking(true);
    try {
      const res = await fetch(`/api/youtube/live-status?channel=@fajopademarilia${force ? "&force=true" : ""}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.warn("[YouTube Live] Falha ao verificar status ao vivo:", err);
    } finally {
      setLoading(false);
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkLiveStatus(false);

    // Check periodically every 60 seconds
    const interval = setInterval(() => {
      checkLiveStatus(false);
    }, 60000);

    // Recheck when user returns to window tab
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

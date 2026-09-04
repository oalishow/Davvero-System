// Netlify Serverless Function for YouTube Live Status Detection
// Runs in AWS Lambda / Netlify Edge without CORS issues

export async function handler(event, context) {
  const channelHandle = event?.queryStringParameters?.channel || "@fajopademarilia";
  const channelUrl = `https://www.youtube.com/${channelHandle}`;
  const liveUrl = `https://www.youtube.com/${channelHandle}/live`;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=30",
  };

  if (event?.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(liveUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);
    const html = await response.text();

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

    let title = null;
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      title = titleMatch[1]
        .replace(/ - YouTube$/, "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        isLive,
        channel: channelHandle,
        channelUrl,
        liveUrl,
        watchUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : liveUrl,
        videoId,
        title: isLive ? title : null,
        checkedAt: new Date().toISOString(),
        source: "netlify-function",
      }),
    };
  } catch (err) {
    console.error("[Netlify Function youtube-live] Error:", err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        isLive: false,
        channel: channelHandle,
        channelUrl,
        liveUrl,
        watchUrl: null,
        videoId: null,
        title: null,
        checkedAt: new Date().toISOString(),
        error: err.message,
        source: "netlify-function-fallback",
      }),
    };
  }
}

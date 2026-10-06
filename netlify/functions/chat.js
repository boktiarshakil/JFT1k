// Netlify Function: AI Chat Proxy
// Proxies requests to LongCat API with proper error handling and CORS

const FETCH_TIMEOUT = 9000; // 9s — stay under Netlify's 10s free tier limit

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: { message: "Method Not Allowed. Use POST." } }),
    };
  }

  const apiKey = process.env.LONGCAT_API_KEY;
  if (!apiKey) {
    console.error("LONGCAT_API_KEY is missing from environment");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: { message: "Server configuration error: API key not set." } }),
    };
  }

  // Validate request body
  let requestBody;
  try {
    requestBody = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: { message: "Invalid JSON in request body." } }),
    };
  }

  if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: { message: "Request must include 'messages' array." } }),
    };
  }

  try {
    // Cap max_tokens to reduce response time
    const maxTokens = Math.min(requestBody.max_tokens || 800, 1000);

    const response = await fetchWithTimeout(
      "https://api.longcat.chat/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: requestBody.model || "LongCat-Flash-Chat",
          messages: requestBody.messages,
          stream: false,
          max_tokens: maxTokens,
          temperature: requestBody.temperature ?? 0.7,
        }),
      },
      FETCH_TIMEOUT
    );

    // Try to parse response as JSON — handle non-JSON error pages gracefully
    let data;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("LongCat returned non-JSON response:", responseText.substring(0, 200));
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: {
            message: `Upstream API returned non-JSON response (HTTP ${response.status}). Please try again.`,
          },
        }),
      };
    }

    // If the upstream returned an error in valid JSON, forward it
    if (!response.ok) {
      console.error("LongCat API error:", response.status, JSON.stringify(data).substring(0, 300));
    }

    return {
      statusCode: response.ok ? 200 : response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    const isTimeout = error.name === "AbortError";
    console.error("Proxy error:", isTimeout ? "TIMEOUT after " + FETCH_TIMEOUT + "ms" : error.message);

    return {
      statusCode: isTimeout ? 504 : 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: {
          message: isTimeout
            ? "সার্ভার টাইমআউট — LongCat API থেকে দেরিতে উত্তর পাচ্ছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
            : `সার্ভার ত্রুটি: ${error.message}`,
        },
      }),
    };
  }
};

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("API KEY exists:", !!process.env.ANTHROPIC_API_KEY);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    body.model = "claude-haiku-4-5-20251001";

    const maxRetries = 2;
    let lastRes: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${maxRetries}...`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }

      lastRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (lastRes.ok || lastRes.status !== 529) break;
    }

    if (!lastRes!.ok) {
      const err = await lastRes!.text();
      console.log("Anthropic API error:", lastRes!.status, err);
      return NextResponse.json({ error: err }, { status: lastRes!.status });
    }

    const data = await lastRes!.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.log("Proxy error:", err.message);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}

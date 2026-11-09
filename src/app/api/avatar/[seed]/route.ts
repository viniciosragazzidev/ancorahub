import { NextResponse } from "next/server";

import {
  MAX_AVATAR_SEED_LENGTH,
  SVG_SECURITY_HEADERS,
  buildFallbackAvatarSvg,
  parseAvatarSize,
  parseAvatarStyle,
} from "./avatar-svg";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ seed: string }> }
) {
  const { seed: rawSeed } = await params;
  const seed = rawSeed.slice(0, MAX_AVATAR_SEED_LENGTH);
  const { searchParams } = new URL(request.url);
  const style = parseAvatarStyle(searchParams.get("style"));
  const size = parseAvatarSize(searchParams.get("size"));

  const diceBearUrl = `https://api.dicebear.com/9.x/${encodeURIComponent(
    style
  )}/svg?seed=${encodeURIComponent(seed)}&size=${size}`;

  try {
    const res = await fetch(diceBearUrl, {
      next: { revalidate: 31536000 },
    });

    if (!res.ok) {
      return new Response(buildFallbackAvatarSvg(seed, size), {
        headers: { ...SVG_SECURITY_HEADERS, "Cache-Control": "public, max-age=86400" },
      });
    }

    const svg = await res.text();

    return new Response(svg, {
      headers: { ...SVG_SECURITY_HEADERS, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate avatar" }, { status: 500 });
  }
}

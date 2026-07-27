import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ seed: string }> }
) {
  const { seed } = await params;
  const { searchParams } = new URL(request.url);
  const style = searchParams.get("style") || "lorelei";
  const size = searchParams.get("size") || "128";

  const diceBearUrl = `https://api.dicebear.com/9.x/${encodeURIComponent(
    style
  )}/svg?seed=${encodeURIComponent(seed)}&size=${encodeURIComponent(size)}`;

  try {
    const res = await fetch(diceBearUrl, {
      next: { revalidate: 31536000 },
    });

    if (!res.ok) {
      // Fallback SVG if DiceBear HTTP fails
      const initials = seed
        ? seed
            .split(" ")
            .map((word) => word[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
        : "CT";

      const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#3b82f6" />
        <text x="50" y="55" font-family="sans-serif" font-size="36" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
      </svg>`;

      return new Response(fallbackSvg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const svg = await res.text();

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate avatar" }, { status: 500 });
  }
}

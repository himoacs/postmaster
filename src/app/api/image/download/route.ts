import { NextRequest, NextResponse } from "next/server";

// POST /api/image/download - Proxy image download to avoid CORS
export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL required" },
        { status: 400 }
      );
    }

    // Fetch the image from the external URL on the server side
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: response.status }
      );
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return the image with appropriate headers for download
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": blob.type || "image/png",
        "Content-Disposition": `attachment; filename="postmaster-image-${Date.now()}.png"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Image download proxy error:", error);
    return NextResponse.json(
      { error: "Failed to download image" },
      { status: 500 }
    );
  }
}

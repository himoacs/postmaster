import { NextRequest, NextResponse } from "next/server";
import { analyzeReadability } from "@/lib/analysis/readability";

// POST /api/analyze/readability - Analyze content readability
export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const result = analyzeReadability(content);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Readability analysis failed:", error);
    return NextResponse.json(
      { error: "Failed to analyze readability" },
      { status: 500 }
    );
  }
}

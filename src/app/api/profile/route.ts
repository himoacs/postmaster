import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/profile - Save user profile
export async function POST(request: NextRequest) {
  const { bio, context, tone, voice, vocabulary, sentence, patterns, overrides } =
    await request.json();

  // Get or create the single style profile
  const existing = await prisma.styleProfile.findFirst();
  
  if (existing) {
    await prisma.styleProfile.update({
      where: { id: existing.id },
      data: {
        bio,
        context,
        tone,
        voice,
        vocabulary,
        sentence,
        patterns,
        overrides,
      },
    });
  } else {
    await prisma.styleProfile.create({
      data: {
        bio,
        context,
        tone,
        voice,
        vocabulary,
        sentence,
        patterns,
        overrides,
      },
    });
  }

  return NextResponse.json({ success: true });
}

// GET /api/profile - Get user profile
export async function GET() {
  const profile = await prisma.styleProfile.findFirst();
  return NextResponse.json({ profile });
}

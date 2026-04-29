import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/keys/status
 * Returns API key configuration status for header indicator
 */
export async function GET() {
  try {
    // Count valid API keys
    const validKeyCount = await prisma.aPIKey.count({
      where: { isValid: true },
    });

    // Check if LiteLLM is configured
    const litellmConfig = await prisma.liteLLMConfig.findFirst({
      where: { isEnabled: true, isValid: true },
    });

    const hasLiteLLM = !!litellmConfig;
    const totalProviders = validKeyCount + (hasLiteLLM ? 1 : 0);

    return NextResponse.json({
      validKeyCount,
      hasLiteLLM,
      totalProviders,
    });
  } catch (error) {
    console.error("Error fetching API key status:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}

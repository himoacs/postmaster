import { KeyValidationResult } from "@/types";

const STABILITY_BASE_URL = "https://api.stability.ai";

export async function validateStabilityKey(
  apiKey: string
): Promise<KeyValidationResult> {
  try {
    const response = await fetch(`${STABILITY_BASE_URL}/v1/user/account`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return {
        valid: false,
        error: "Invalid API key",
      };
    }

    return {
      valid: true,
      models: ["stable-diffusion-xl-1024-v1-0", "stable-image-ultra"],
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid API key",
    };
  }
}

export async function generateImageWithStability(
  apiKey: string,
  prompt: string,
  negativePrompt?: string,
  style?: string
): Promise<string> {
  const response = await fetch(
    `${STABILITY_BASE_URL}/v2beta/stable-image/generate/core`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: (() => {
        const formData = new FormData();
        formData.append("prompt", prompt);
        if (negativePrompt) {
          formData.append("negative_prompt", negativePrompt);
        }
        if (style) {
          formData.append("style_preset", style);
        }
        formData.append("output_format", "webp");
        return formData;
      })(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Image generation failed");
  }

  const result = await response.json();
  
  // Return base64 data URL
  if (result.image) {
    return `data:image/webp;base64,${result.image}`;
  }
  
  throw new Error("No image returned from Stability AI");
}

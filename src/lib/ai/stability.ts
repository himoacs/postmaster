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
      let errorMessage = "Invalid API key";
      
      if (response.status === 401) {
        errorMessage = "Invalid API key. Please check your key at platform.stability.ai/account/keys";
      } else if (response.status === 429) {
        errorMessage = "Rate limit exceeded. Please wait and try again.";
      } else if (response.status === 403) {
        errorMessage = "Access forbidden. Check your account status.";
      } else if (response.status === 402) {
        errorMessage = "Insufficient credits. Please add credits at platform.stability.ai/account/credits";
      }
      
      return {
        valid: false,
        error: errorMessage,
      };
    }

    return {
      valid: true,
      models: ["stable-diffusion-xl-1024-v1-0", "stable-image-ultra"],
    };
  } catch (error: any) {
    let errorMessage = "Invalid API key";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      valid: false,
      error: errorMessage,
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

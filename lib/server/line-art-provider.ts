import "server-only";

import { createLineArtDataUrl, pickFlavor } from "@/lib/line-art";

type GeneratedImage = {
  dataBase64: string;
  mimeType: string;
  modelName: string;
  textResponse?: string;
};

type SourceImageInput = {
  prompt: string;
  baseImage?: {
    dataBase64: string;
    mimeType: string;
  };
};

type LineArtInput = {
  prompt: string;
  sourceImage: {
    dataBase64: string;
    mimeType: string;
  };
};

type Provider = {
  generateSourceImage(input: SourceImageInput): Promise<GeneratedImage>;
  convertToLineArt(input: LineArtInput): Promise<GeneratedImage>;
};

class DemoLineArtProvider implements Provider {
  async generateSourceImage({ prompt }: SourceImageInput): Promise<GeneratedImage> {
    const flavor = pickFlavor(prompt);

    await new Promise((resolve) => {
      setTimeout(resolve, 900);
    });

    return {
      dataBase64: extractBase64Payload(createLineArtDataUrl(flavor.key)),
      mimeType: "image/svg+xml",
      modelName: "demo-source-image",
      textResponse: "Created a source image."
    };
  }

  async convertToLineArt({ prompt }: LineArtInput): Promise<GeneratedImage> {
    const flavor = pickFlavor(prompt);

    await new Promise((resolve) => {
      setTimeout(resolve, 900);
    });

    return {
      dataBase64: extractBase64Payload(createLineArtDataUrl(flavor.key)),
      mimeType: "image/svg+xml",
      modelName: "demo-line-art",
      textResponse: `${flavor.copy} Tap the image to open it and save it.`
    };
  }
}

class GeminiLineArtProvider implements Provider {
  async generateSourceImage({ prompt, baseImage }: SourceImageInput): Promise<GeneratedImage> {
    const instruction = baseImage
      ? buildSourceEditPrompt(prompt)
      : buildSourceImagePrompt(prompt);
    const parts = baseImage
      ? [
          { text: instruction },
          {
            inlineData: {
              mimeType: baseImage.mimeType,
              data: baseImage.dataBase64
            }
          }
        ]
      : [{ text: instruction }];

    return generateGeminiImage({
      modelName: process.env.GEMINI_SOURCE_IMAGE_MODEL ?? "gemini-2.5-flash-image",
      parts
    });
  }

  async convertToLineArt({ prompt, sourceImage }: LineArtInput): Promise<GeneratedImage> {
    return generateGeminiImage({
      modelName: process.env.GEMINI_LINE_ART_MODEL ?? "gemini-2.5-flash-image",
      parts: [
        {
          text: buildLineArtPrompt(prompt)
        },
        {
          inlineData: {
            mimeType: sourceImage.mimeType,
            data: sourceImage.dataBase64
          }
        }
      ]
    });
  }
}

function buildSourceImagePrompt(userPrompt: string) {
  return `Create a clean, polished illustration based on this description: "${userPrompt}".

Requirements:
- Single clear composition with one primary subject or scene.
- Friendly, storybook-style illustration with readable shapes.
- Portrait orientation, suitable for later conversion to an A4 coloring page.
- Avoid text, logos, watermarks, or collage layouts.
- Keep the image easy to simplify into line art later.`;
}

function buildSourceEditPrompt(userPrompt: string) {
  return `Edit the provided image according to this request: "${userPrompt}".

Requirements:
- Preserve the identity, pose, and overall composition where possible.
- Apply the requested change clearly.
- Keep the result as a clean illustrated image that can be converted to line art later.
- Avoid text, watermarks, and excessive detail.`;
}

function buildLineArtPrompt(userPrompt: string) {
  const promptTail = userPrompt.trim()
    ? `Additional user request: "${userPrompt}".`
    : "No extra user request was provided.";

  return `Convert the provided image into printable black-and-white line art for a coloring page.

Requirements:
- Keep the main subject, pose, and composition recognizable.
- Use clean bold outlines only.
- Output must be pure black lines on a pure white background only.
- Do not use any color, grayscale, tint, shading, gradients, or antialiased color edges.
- White background.
- Remove shading, gradients, textures, and color fills.
- Simplify tiny background details, but preserve the main scene.
- Make the output feel like a polished coloring-book page.
- Portrait composition suitable for A4 print.
- Any non-black, non-white pixel is invalid.

${promptTail}`;
}

function extractBase64Payload(dataUrl: string) {
  const match = dataUrl.match(/^data:[^;]+;base64,(.*)$/);

  if (match) {
    return match[1];
  }

  return Buffer.from(decodeURIComponent(dataUrl.replace(/^data:[^,]+,/, ""))).toString("base64");
}

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

async function generateGeminiImage({
  modelName,
  parts
}: {
  modelName: string;
  parts: GeminiPart[];
}): Promise<GeneratedImage> {
  const apiKey = getGeminiApiKey();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts
          }
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      })
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errorMsg =
      (errorBody as { error?: { message?: string } })?.error?.message ??
      `Gemini API error: ${response.status}`;

    throw new Error(errorMsg);
  }

  const data = (await response.json()) as GeminiImageResponse;
  const partsList = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart =
    partsList.find((part) => part.inlineData?.data) ??
    partsList.find((part) => part.inline_data?.data);

  if (!imagePart) {
    throw new Error("Gemini did not return an image. Please try a simpler prompt.");
  }

  const inlineData = imagePart.inlineData ?? imagePart.inline_data;

  if (!inlineData?.data || !inlineData.mimeType) {
    throw new Error("Gemini returned an incomplete image response.");
  }

  return {
    dataBase64: inlineData.data,
    mimeType: inlineData.mimeType,
    modelName,
    textResponse: partsList.map((part) => part.text).filter(Boolean).join(" ").trim() || undefined
  };
}

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY is not set. Add a valid Gemini API key in the deployment environment.");
  }

  // Gemini's Generative Language REST API expects an API key. A 3-part JWT here
  // usually means a platform integration injected a service-account credential instead.
  if (looksLikeJwt(apiKey)) {
    throw new Error(
      "GEMINI_API_KEY contains a JWT/service-account credential, not a Gemini API key. Remove the injected credential and configure a real Gemini API key, or switch the app to server-side Google auth/Vertex AI."
    );
  }

  return apiKey;
}

function looksLikeJwt(value: string) {
  const parts = value.split(".");

  return parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part));
}

type GeminiImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
        inline_data?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
};

export function deriveRevisionTitle(prompt: string, sourceType: "prompt" | "upload" | "revision") {
  const raw = prompt.trim().replace(/[.!?]+$/, "");

  if (!raw) {
    return sourceType === "upload" ? "Uploaded image" : "New drawing";
  }

  const title = raw.length <= 40 ? raw : `${raw.slice(0, 40).trim()}…`;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function getProvider(): Provider {
  const providerName = process.env.LINE_ART_PROVIDER ?? "demo";

  switch (providerName) {
    case "demo":
      return new DemoLineArtProvider();
    case "gemini":
      return new GeminiLineArtProvider();
    default:
      throw new Error(`Unsupported LINE_ART_PROVIDER: ${providerName}`);
  }
}

export async function generateSourceImage(input: SourceImageInput) {
  return getProvider().generateSourceImage(input);
}

export async function convertToLineArt(input: LineArtInput) {
  return getProvider().convertToLineArt(input);
}

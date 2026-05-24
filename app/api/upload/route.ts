import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_TYPES = [
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
];

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId }),
      }),
      onUploadCompleted: async () => {
        // Nothing to do — the client receives the URL and stores it via the card form action.
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Image upload failed.",
      },
      { status: 400 }
    );
  }
}

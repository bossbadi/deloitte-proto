import { env } from 'cloudflare:workers';
import { createGeminiDraftResponse, type GeminiConfig } from '@/lib/gemini-draft';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const config = env as unknown as GeminiConfig;
  return createGeminiDraftResponse(request, {
    GEMINI_API_KEY: config.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    GEMINI_MODEL: config.GEMINI_MODEL || process.env.GEMINI_MODEL,
  });
}

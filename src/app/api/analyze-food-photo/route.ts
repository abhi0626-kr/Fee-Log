import { NextRequest, NextResponse } from 'next/server';

interface FoodScanResult {
  items: string;
  carb_size: 'small' | 'medium' | 'large';
  carbs_g: number;
  protein_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg?: number;
  calories: number;
  explanation: string;
}

const isImageCapableModel = (modelName: string): boolean => {
  const normalizedName = modelName.toLowerCase();
  return (
    normalizedName.startsWith('gemini-') &&
    !/(?:tts|audio|embedding|embed|aqa|image-generation|robotics)/.test(normalizedName)
  );
};

/**
 * Dynamically queries available models from Google for this specific API key,
 * or returns a ranked list of robust fallback candidates.
 */
async function getGeminiCandidateModels(apiKey: string, configuredModel?: string): Promise<string[]> {
  const hardcodedFallbacks = [
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
  ];

  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData.models)) {
        const valid = listData.models
          .filter(
            (m: { supportedGenerationMethods?: string[]; name?: string }) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes('generateContent') &&
              m.name &&
              isImageCapableModel(m.name)
          )
          .map((m: { name: string }) => m.name.replace(/^models\//, ''));

        if (valid.length > 0) {
          const sorted = valid.sort((a: string, b: string) => {
            const getScore = (name: string) => {
              let score = 0;
              if (name.includes('flash')) score += 20;
              if (name.includes('3.8')) score += 30;
              if (name.includes('3.0')) score += 25;
              if (name.includes('2.5')) score += 20;
              if (name === 'gemini-2.0-flash') score -= 30; // Retired by Google
              if (name.includes('2.0')) score -= 20;
              if (name.includes('1.5')) score -= 10;
              if (name.includes('latest')) score += 2;
              if (name.includes('pro')) score += 1;
              return score;
            };
            return getScore(b) - getScore(a);
          });
          return Array.from(new Set([configuredModel, ...sorted, ...hardcodedFallbacks].filter(Boolean) as string[]));
        }
      }
    }
  } catch {
    // If list models call fails, fall back to hardcoded sequence
  }

  return Array.from(new Set([configuredModel, ...hardcodedFallbacks].filter(Boolean) as string[]));
}

function formatScanResult(parsed: Partial<FoodScanResult>): FoodScanResult {
  const cleanCarbs = Math.max(0, Math.round(Number(parsed.carbs_g ?? 0) * 10) / 10);
  const cleanProtein = Math.max(0, Math.round(Number(parsed.protein_g ?? 0) * 10) / 10);
  const cleanFiber = Math.max(0, Math.round(Number(parsed.fiber_g ?? 0) * 10) / 10);
  const cleanSugar = Math.max(0, Math.round(Number(parsed.sugar_g ?? 0) * 10) / 10);
  const cleanSodium = Math.max(0, Math.round(Number(parsed.sodium_mg ?? 0)));
  const cleanCalories =
    Number(parsed.calories) > 0
      ? Math.round(Number(parsed.calories))
      : Math.round(cleanCarbs * 4 + cleanProtein * 4);

  const validCarbSizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
  const cleanSize = validCarbSizes.includes(parsed.carb_size as 'small' | 'medium' | 'large')
    ? (parsed.carb_size as 'small' | 'medium' | 'large')
    : cleanCarbs > 75
    ? 'large'
    : cleanCarbs > 35
    ? 'medium'
    : 'small';

  return {
    items: parsed.items?.trim() || 'Identified meal plate',
    carb_size: cleanSize,
    carbs_g: cleanCarbs,
    protein_g: cleanProtein,
    fiber_g: cleanFiber,
    sugar_g: cleanSugar,
    sodium_mg: cleanSodium,
    calories: cleanCalories,
    explanation: parsed.explanation?.trim() || 'Food items and macro profile calculated via AI.',
  };
}

async function getGroqCandidateModels(apiKey: string, configuredModel?: string): Promise<string[]> {
  const fallbackModels = [
    'qwen/qwen3.8-27b',
    'llama-3.2-11b-vision-preview',
    'llama-3.2-90b-vision-preview',
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) {
      const data = (await response.json()) as { data?: { id?: string }[] };
      const availableModels = (data.data || [])
        .map((model) => model.id)
        .filter((model): model is string => Boolean(model));
      const visionModels = availableModels.filter((model) => {
        const normalized = model.toLowerCase();
        return (
          normalized.includes('qwen') ||
          normalized.includes('vision') ||
          normalized.includes('llama-4') ||
          normalized.includes('vl') ||
          normalized.includes('spark')
        );
      });

      if (visionModels.length > 0) {
        visionModels.sort((a, b) => {
          const score = (m: string) => {
            const lower = m.toLowerCase();
            if (lower.includes('qwen3.8-27b')) return 50;
            if (lower.includes('vision')) return 40;
            if (lower.includes('qwen')) return 30;
            return 10;
          };
          return score(b) - score(a);
        });
        return Array.from(new Set([configuredModel, ...visionModels, ...fallbackModels].filter(Boolean) as string[]));
      }
    }
  } catch {
    // Continue with known vision model candidates if model discovery is unavailable.
  }

  return Array.from(new Set([configuredModel, ...fallbackModels].filter(Boolean) as string[]));
}

async function executeGroqScan(
  apiKey: string,
  mimeType: string,
  rawBase64: string,
  systemPrompt: string
): Promise<FoodScanResult> {
  const modelCandidates = await getGroqCandidateModels(apiKey, process.env.GROQ_MODEL?.trim());
  let lastGroqError = 'Groq did not return a response.';

  for (const modelName of modelCandidates) {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze the food in this photo and return the estimated nutrition breakdown according to the requested JSON schema.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${rawBase64}` },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (groqResponse.ok) {
      const groqData = await groqResponse.json();
      const content = groqData.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from Groq.');
      }
      return formatScanResult(JSON.parse(content));
    }

    const errText = await groqResponse.text();
    try {
      const parsedErr = JSON.parse(errText);
      lastGroqError = parsedErr.error?.message || errText;
    } catch {
      lastGroqError = errText || `Groq API error (${groqResponse.status})`;
    }

    const lowerError = lastGroqError.toLowerCase();
    const canTryAnotherModel =
      groqResponse.status === 404 ||
      groqResponse.status === 400 ||
      lowerError.includes('does not exist') ||
      lowerError.includes('do not have access') ||
      lowerError.includes('decommissioned') ||
      lowerError.includes('deprecated') ||
      lowerError.includes('not found') ||
      lowerError.includes('unsupported') ||
      lowerError.includes('invalid model');
    if (!canTryAnotherModel) break;
  }

  throw new Error(lastGroqError);
}

async function executeOpenAiScan(
  apiKey: string,
  mimeType: string,
  rawBase64: string,
  systemPrompt: string
): Promise<FoodScanResult> {
  const modelName = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const openAiUrl = 'https://api.openai.com/v1/chat/completions';

  const openAiResponse = await fetch(openAiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze the food in this photo and return the estimated nutrition breakdown according to the requested JSON schema.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${rawBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  if (!openAiResponse.ok) {
    const errText = await openAiResponse.text();
    let errMsg = `OpenAI API error (${openAiResponse.status})`;
    try {
      const parsedErr = JSON.parse(errText);
      errMsg = parsedErr.error?.message || errMsg;
    } catch {
      errMsg = errText || errMsg;
    }
    throw new Error(errMsg);
  }

  const openAiData = await openAiResponse.json();
  const content = openAiData.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content received from OpenAI.');
  }

  return formatScanResult(JSON.parse(content));
}

async function executeGeminiScan(
  apiKey: string,
  mimeType: string,
  rawBase64: string,
  systemPrompt: string
): Promise<FoodScanResult> {
  const candidateModels = await getGeminiCandidateModels(apiKey, process.env.GEMINI_MODEL?.trim());

  interface GeminiApiResponse {
    candidates?: {
      content?: {
        parts?: {
          text?: string;
        }[];
      };
    }[];
    error?: {
      message?: string;
    };
  }

  let geminiData: GeminiApiResponse | null = null;
  let lastErrorMsg = 'Failed to connect to Google Gemini API.';

  for (const modelName of candidateModels) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                {
                  inlineData: {
                    mimeType,
                    data: rawBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      });

      if (response.ok) {
        geminiData = await response.json();
        break;
      }

      const errText = await response.text();
      try {
        const parsedErr = JSON.parse(errText);
        lastErrorMsg = parsedErr.error?.message || errText;
      } catch {
        lastErrorMsg = errText;
      }

      const lowerErrorMessage = lastErrorMsg.toLowerCase();
      const isUnsupportedModel =
        response.status === 404 ||
        lowerErrorMessage.includes('not found') ||
        lowerErrorMessage.includes('image input modality') ||
        lowerErrorMessage.includes('does not support image') ||
        lowerErrorMessage.includes('modality is not enabled') ||
        lowerErrorMessage.includes('no longer available') ||
        lowerErrorMessage.includes('not available to new users');

      if (isUnsupportedModel) {
        continue;
      } else {
        break;
      }
    } catch (err) {
      lastErrorMsg = (err as Error).message;
    }
  }

  if (!geminiData) {
    throw new Error(lastErrorMsg);
  }

  const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText) {
    throw new Error('No response candidate received from Gemini.');
  }

  return formatScanResult(JSON.parse(candidateText));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, apiKey, mealHint, isDemo } = body as {
      imageBase64?: string;
      apiKey?: string;
      mealHint?: string;
      isDemo?: boolean;
    };

    if (!imageBase64 && !isDemo) {
      return NextResponse.json(
        { success: false, error: 'NO_IMAGE', message: 'No food image was provided.' },
        { status: 400 }
      );
    }

    // Simulated Demo Scan if requested
    if (isDemo) {
      const demoResult: FoodScanResult = {
        items:
          mealHint === 'breakfast'
            ? '3 idly with sambar and coconut chutney'
            : mealHint === 'dinner'
            ? '2 chapathi with paneer sabzi and curd'
            : 'Rice plate with dal, mixed veg curry and curd',
        carb_size: 'medium',
        carbs_g: mealHint === 'breakfast' ? 58 : mealHint === 'dinner' ? 44 : 68,
        protein_g: mealHint === 'breakfast' ? 12 : mealHint === 'dinner' ? 18 : 14,
        fiber_g: mealHint === 'breakfast' ? 6 : mealHint === 'dinner' ? 5.5 : 5,
        sugar_g: mealHint === 'breakfast' ? 3.5 : mealHint === 'dinner' ? 4.2 : 2.5,
        sodium_mg: mealHint === 'breakfast' ? 640 : mealHint === 'dinner' ? 510 : 680,
        calories: mealHint === 'breakfast' ? 340 : mealHint === 'dinner' ? 390 : 470,
        explanation:
          '✨ AI Plate Scanner simulated detection: Identified plate items, carb portions, and sugar profile.',
      };

      return NextResponse.json({ success: true, data: demoResult, isDemo: true });
    }

    // Extract base64 payload & mime type
    let mimeType = 'image/jpeg';
    let rawBase64 = imageBase64 || '';

    const match = rawBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      rawBase64 = match[2];
    }

    const systemPrompt = `You are an expert clinical dietitian and diabetes educator specializing in precision carb counting and fitness macronutrient estimation.
Analyze the user's food photo carefully.
1. Identify all recognizable food items and estimated portions (e.g., 2 medium dosas, 1 cup sambar, 1 cup steamed rice, 2 rotis with dal).
2. Calculate realistic nutritional values:
   - Total Carbohydrates in grams (carbs_g)
   - Protein in grams (protein_g)
   - Dietary Fiber in grams (fiber_g)
   - Sugar in grams (sugar_g)
   - Estimated Calories in kcal (calories)
3. Classify carb_size as exactly one of: 'small', 'medium', or 'large'.
4. Provide a friendly 1-2 sentence explanation of your estimate.

Respond strictly in valid JSON matching this schema:
{
  "items": string,
  "carb_size": "small" | "medium" | "large",
  "carbs_g": number,
  "protein_g": number,
  "fiber_g": number,
  "sugar_g": number,
  "calories": number,
  "explanation": string
}`;

    const isGroqKey = (key?: string) => Boolean(key && key.startsWith('gsk_'));
    const isOpenAiKey = (key?: string) => Boolean(key && key.startsWith('sk-') && !key.startsWith('sk-ant-'));

    const userKey = apiKey?.trim();

    // PATH 1: Client explicitly supplied a key from modal or settings
    if (userKey) {
      try {
        if (isGroqKey(userKey)) {
          const result = await executeGroqScan(userKey, mimeType, rawBase64, systemPrompt);
          return NextResponse.json({ success: true, data: result });
        } else if (isOpenAiKey(userKey)) {
          const result = await executeOpenAiScan(userKey, mimeType, rawBase64, systemPrompt);
          return NextResponse.json({ success: true, data: result });
        } else {
          const result = await executeGeminiScan(userKey, mimeType, rawBase64, systemPrompt);
          return NextResponse.json({ success: true, data: result });
        }
      } catch (err) {
        return NextResponse.json(
          { success: false, error: 'SCAN_FAILED', message: (err as Error).message },
          { status: 502 }
        );
      }
    }

    // PATH 2: Server-side environment variables (Vercel production / local .env)
    const serverGroqKey =
      process.env.GROQ_API_KEY?.trim() ||
      (process.env.OPENAI_API_KEY?.trim().startsWith('gsk_') ? process.env.OPENAI_API_KEY.trim() : undefined);
    const serverGeminiKey =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
    const serverOpenAiKey =
      process.env.OPENAI_API_KEY?.trim().startsWith('sk-') ? process.env.OPENAI_API_KEY.trim() : undefined;

    if (!serverGroqKey && !serverGeminiKey && !serverOpenAiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'NO_API_KEY',
          message:
            'API key required. Add your Groq (gsk_...), OpenAI (sk-...), or Google Gemini (AIzaSy...) key in Settings or Vercel environment variables to scan.',
        },
        { status: 401 }
      );
    }

    let lastError = '';

    // Prioritize Groq if configured
    if (serverGroqKey) {
      try {
        const result = await executeGroqScan(serverGroqKey, mimeType, rawBase64, systemPrompt);
        return NextResponse.json({ success: true, data: result });
      } catch (err) {
        lastError = `Groq: ${(err as Error).message}`;
        console.warn(`${lastError}. Trying server fallback provider if configured...`);
      }
    }

    // Fall back to Gemini if configured
    if (serverGeminiKey) {
      try {
        const result = await executeGeminiScan(serverGeminiKey, mimeType, rawBase64, systemPrompt);
        return NextResponse.json({ success: true, data: result });
      } catch (err) {
        lastError = `Gemini: ${(err as Error).message}`;
        console.warn(`${lastError}. Trying server fallback provider if configured...`);
      }
    }

    // Fall back to OpenAI if configured
    if (serverOpenAiKey) {
      try {
        const result = await executeOpenAiScan(serverOpenAiKey, mimeType, rawBase64, systemPrompt);
        return NextResponse.json({ success: true, data: result });
      } catch (err) {
        lastError = `OpenAI: ${(err as Error).message}`;
      }
    }

    return NextResponse.json(
      { success: false, error: 'SCAN_FAILED', message: lastError || 'Failed to analyze food plate.' },
      { status: 502 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'SERVER_ERROR', message: (error as Error).message },
      { status: 500 }
    );
  }
}

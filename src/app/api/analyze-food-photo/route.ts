import { NextRequest, NextResponse } from 'next/server';

interface FoodScanResult {
  items: string;
  carb_size: 'small' | 'medium' | 'large';
  carbs_g: number;
  protein_g: number;
  fiber_g: number;
  sodium_mg: number;
  calories: number;
  explanation: string;
}

/**
 * Dynamically queries available models from Google for this specific API key,
 * or returns a ranked list of robust fallback candidates.
 */
async function getCandidateModels(apiKey: string): Promise<string[]> {
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
              m.name
          )
          .map((m: { name: string }) => m.name.replace(/^models\//, ''));

        if (valid.length > 0) {
          // Rank preferred models: flash models first, then 1.5, then 2.0
          return valid.sort((a: string, b: string) => {
            const getScore = (name: string) => {
              let score = 0;
              if (name.includes('flash')) score += 20;
              if (name.includes('1.5')) score += 10;
              if (name.includes('2.0') || name.includes('2.5')) score += 8;
              if (name.includes('latest')) score += 5;
              if (name.includes('pro')) score += 2;
              return score;
            };
            return getScore(b) - getScore(a);
          });
        }
      }
    }
  } catch {
    // If list models call fails, fall back to hardcoded sequence
  }

  return [
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-001',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
    'gemini-2.5-flash',
  ];
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

    const resolvedApiKey =
      apiKey?.trim() ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // Simulated Demo Scan if requested or if no key available but demo requested
    if (isDemo || (!resolvedApiKey && isDemo)) {
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
        sodium_mg: mealHint === 'breakfast' ? 640 : mealHint === 'dinner' ? 510 : 680,
        calories: mealHint === 'breakfast' ? 340 : mealHint === 'dinner' ? 390 : 470,
        explanation:
          '✨ AI Plate Scanner simulated detection: Identified plate items, carb portions, and electrolyte sodium profile.',
      };

      return NextResponse.json({ success: true, data: demoResult, isDemo: true });
    }

    if (!resolvedApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'NO_API_KEY',
          message:
            'Google Gemini API key required. Add your free key in Settings or enter it to scan.',
        },
        { status: 401 }
      );
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
   - Sodium in milligrams (sodium_mg)
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
  "sodium_mg": number,
  "calories": number,
  "explanation": string
}`;

    // Dynamically discover which Gemini models are available for this user's API key
    const candidateModels = await getCandidateModels(resolvedApiKey);

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
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${resolvedApiKey}`;

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

        // If it's a 404 or model not found, try the next model candidate
        if (response.status === 404 || lastErrorMsg.toLowerCase().includes('not found')) {
          continue;
        } else {
          // If it's a key/quota error (e.g. 400 or 403), stop retrying
          break;
        }
      } catch (err) {
        lastErrorMsg = (err as Error).message;
      }
    }

    if (!geminiData) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_ERROR', message: lastErrorMsg },
        { status: 502 }
      );
    }

    const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return NextResponse.json(
        {
          success: false,
          error: 'EMPTY_RESPONSE',
          message: 'No response candidate received from Gemini.',
        },
        { status: 502 }
      );
    }

    let parsed: Partial<FoodScanResult>;
    try {
      parsed = JSON.parse(candidateText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'PARSE_ERROR',
          message: 'Failed to parse JSON response from Gemini.',
        },
        { status: 502 }
      );
    }

    const cleanCarbs = Math.max(0, Math.round(Number(parsed.carbs_g ?? 0) * 10) / 10);
    const cleanProtein = Math.max(0, Math.round(Number(parsed.protein_g ?? 0) * 10) / 10);
    const cleanFiber = Math.max(0, Math.round(Number(parsed.fiber_g ?? 0) * 10) / 10);
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

    const result: FoodScanResult = {
      items: parsed.items?.trim() || 'Identified meal plate',
      carb_size: cleanSize,
      carbs_g: cleanCarbs,
      protein_g: cleanProtein,
      fiber_g: cleanFiber,
      sodium_mg: cleanSodium,
      calories: cleanCalories,
      explanation: parsed.explanation?.trim() || 'Food items and macro profile calculated via AI.',
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'SERVER_ERROR', message: (error as Error).message },
      { status: 500 }
    );
  }
}

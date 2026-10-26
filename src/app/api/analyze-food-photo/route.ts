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
        items: mealHint === 'breakfast'
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
        explanation: '✨ AI Plate Scanner simulated detection: Identified plate items, carb portions, and electrolyte sodium profile.',
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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${resolvedApiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: rawBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Gemini API returned status ${response.status}`;
      try {
        const parsedErr = JSON.parse(errText);
        if (parsedErr.error?.message) {
          errorMsg = parsedErr.error.message;
        }
      } catch {
        // use raw errorMsg
      }

      return NextResponse.json(
        { success: false, error: 'GEMINI_ERROR', message: errorMsg },
        { status: 502 }
      );
    }

    const geminiData = await response.json();
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

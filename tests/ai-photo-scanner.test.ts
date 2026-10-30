import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../src/app/api/analyze-food-photo/route';
import { NextRequest } from 'next/server';

describe('AI Photo Auto-Scanner API Tests', () => {
  test('returns 400 when no image is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze-food-photo', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'NO_IMAGE');
  });

  test('returns demo scan result successfully when isDemo=true', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze-food-photo', {
      method: 'POST',
      body: JSON.stringify({
        isDemo: true,
        mealHint: 'breakfast',
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.carbs_g > 0);
    assert.ok(json.data.protein_g > 0);
    assert.ok(json.data.fiber_g > 0);
    assert.ok(json.data.sodium_mg > 0);
    assert.ok(json.data.items.includes('idly'));
  });

  test('returns 401 when no API key is available and isDemo=false', async () => {
    // Ensure environment keys are not interfering
    const prevGroq = process.env.GROQ_API_KEY;
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevOpenAi = process.env.OPENAI_API_KEY;
    const prevGoogle = process.env.GOOGLE_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const req = new NextRequest('http://localhost:3000/api/analyze-food-photo', {
      method: 'POST',
      body: JSON.stringify({
        imageBase64: 'data:image/jpeg;base64,dummyfakebase64data',
        isDemo: false,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 401);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'NO_API_KEY');

    if (prevGroq) process.env.GROQ_API_KEY = prevGroq;
    if (prevGemini) process.env.GEMINI_API_KEY = prevGemini;
    if (prevOpenAi) process.env.OPENAI_API_KEY = prevOpenAi;
    if (prevGoogle) process.env.GOOGLE_API_KEY = prevGoogle;
  });
});

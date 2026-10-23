import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, anonKey } = body;

    if (!url || !anonKey) {
      return NextResponse.json(
        { success: false, error: 'URL and Anon Key are required' },
        { status: 400 }
      );
    }

    const envPath = path.join(process.cwd(), '.env.local');
    const content = `NEXT_PUBLIC_SUPABASE_URL=${url.trim()}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey.trim()}\n`;

    fs.writeFileSync(envPath, content, 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Supabase credentials saved to .env.local',
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { readDatabase, insertOrUpdateRecord, deleteRecord, TableName } from '@/lib/server-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table') as TableName | null;
    const date = searchParams.get('date');

    const db = readDatabase();

    if (table && db[table]) {
      let data = db[table];
      if (date && Array.isArray(data)) {
        data = (data as { log_date?: string }[]).filter((item) => item.log_date === date) as typeof data;
      }
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: true, data: db });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, record } = body as { table: TableName; record: { id: string } };

    if (!table || !record || !record.id) {
      return NextResponse.json(
        { success: false, error: 'table and record with id are required' },
        { status: 400 }
      );
    }

    const saved = insertOrUpdateRecord(table, record);
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table') as TableName | null;
    const id = searchParams.get('id');

    if (!table || !id) {
      return NextResponse.json(
        { success: false, error: 'table and id are required' },
        { status: 400 }
      );
    }

    const deleted = deleteRecord(table, id);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

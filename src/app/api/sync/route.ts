import { NextRequest, NextResponse } from 'next/server';
import { insertOrUpdateRecord, deleteRecord, TableName } from '@/lib/server-db';

interface SyncItem {
  id: string;
  table: TableName;
  action: 'insert' | 'update' | 'delete';
  payload: { id: string } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = body.items as SyncItem[];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    let processed = 0;
    for (const item of items) {
      if (item.action === 'insert' || item.action === 'update') {
        if (item.payload && item.payload.id) {
          insertOrUpdateRecord(item.table, item.payload);
          processed++;
        }
      } else if (item.action === 'delete') {
        deleteRecord(item.table, item.id);
        processed++;
      }
    }

    return NextResponse.json({ success: true, count: processed });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

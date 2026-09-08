import { NextResponse } from 'next/server';
import { db } from '@/db';
import { syncConfigs, syncLogs } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const configIdParam = searchParams.get('configId');

    let query = db
      .select({
        id: syncLogs.id,
        configId: syncLogs.configId,
        configName: syncConfigs.name,
        tagName: syncLogs.tagName,
        releaseName: syncLogs.releaseName,
        status: syncLogs.status,
        message: syncLogs.message,
        syncedAssets: syncLogs.syncedAssets,
        createdAt: syncLogs.createdAt,
      })
      .from(syncLogs)
      .innerJoin(syncConfigs, eq(syncLogs.configId, syncConfigs.id));

    if (configIdParam) {
      const configId = parseInt(configIdParam, 10);
      if (!isNaN(configId)) {
        // Apply filter
        query = db
          .select({
            id: syncLogs.id,
            configId: syncLogs.configId,
            configName: syncConfigs.name,
            tagName: syncLogs.tagName,
            releaseName: syncLogs.releaseName,
            status: syncLogs.status,
            message: syncLogs.message,
            syncedAssets: syncLogs.syncedAssets,
            createdAt: syncLogs.createdAt,
          })
          .from(syncLogs)
          .innerJoin(syncConfigs, eq(syncLogs.configId, syncConfigs.id))
          .where(eq(syncLogs.configId, configId)) as any; // Cast or construct properly
      }
    }

    const logs = query.orderBy(desc(syncLogs.createdAt)).limit(150).all();
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Clear all history logs
    db.delete(syncLogs).run();
    return NextResponse.json({ success: true, message: 'All logs cleared' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to clear logs' }, { status: 500 });
  }
}

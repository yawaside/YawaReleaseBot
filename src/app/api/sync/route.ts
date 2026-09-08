import { NextResponse } from 'next/server';
import { db } from '@/db';
import { syncConfigs, syncLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { syncSingleRelease, fetchGitHubReleases } from '@/lib/github';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { configId, tagName, overwrite = false } = body;

    if (!configId || !tagName) {
      return NextResponse.json({ error: 'configId and tagName are required' }, { status: 400 });
    }

    // 1. Fetch config from DB
    const config = db
      .select()
      .from(syncConfigs)
      .where(eq(syncConfigs.id, configId))
      .limit(1)
      .get();

    if (!config) {
      return NextResponse.json({ error: 'Sync configuration not found' }, { status: 404 });
    }

    // Create a temporary "syncing" log entry or just run the sync first. Let's run it.
    console.log(`Starting sync for config ID ${configId}, tag ${tagName}. Overwrite: ${overwrite}`);

    // Get the release name from the source first to log it nicely
    let releaseName = tagName;
    try {
      const sourceReleases = await fetchGitHubReleases(config.sourceToken, config.sourceRepoOwner, config.sourceRepoName);
      const matched = sourceReleases.find(r => r.tag_name === tagName);
      if (matched && matched.name) {
        releaseName = matched.name;
      }
    } catch (err) {
      // ignore, fallback to tagName
    }

    // 2. Perform the actual release sync
    const syncResult = await syncSingleRelease({
      source: {
        owner: config.sourceRepoOwner,
        repo: config.sourceRepoName,
        token: config.sourceToken
      },
      dest: {
        owner: config.destRepoOwner,
        repo: config.destRepoName,
        token: config.destToken
      },
      tagName,
      overwrite,
      assetFilter: config.assetFilter,
      updateReadme: config.updateReadme
    });

    // 3. Write sync log
    const newLog = db
      .insert(syncLogs)
      .values({
        configId: config.id,
        tagName,
        releaseName,
        status: syncResult.success ? 'success' : 'failed',
        message: syncResult.message,
        syncedAssets: JSON.stringify(syncResult.syncedAssets),
      })
      .returning()
      .get();

    // 4. If success, update lastSyncAt
    if (syncResult.success) {
      db
        .update(syncConfigs)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(syncConfigs.id, config.id))
        .run();
    }

    return NextResponse.json({
      success: syncResult.success,
      message: syncResult.message,
      syncedAssets: syncResult.syncedAssets,
      skippedAssets: syncResult.skippedAssets,
      readmeUpdated: syncResult.readmeUpdated,
      log: newLog
    });
  } catch (error: any) {
    console.error('API Sync Error:', error);
    return NextResponse.json({ error: error.message || 'Synchronization failed' }, { status: 500 });
  }
}

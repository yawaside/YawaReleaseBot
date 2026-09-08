import { NextResponse } from 'next/server';
import { db } from '@/db';
import { syncConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchGitHubReleases } from '@/lib/github';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const configId = parseInt(id, 10);
    if (isNaN(configId)) {
      return NextResponse.json({ error: 'Invalid config ID' }, { status: 400 });
    }

    const config = db
      .select()
      .from(syncConfigs)
      .where(eq(syncConfigs.id, configId))
      .limit(1)
      .get();

    if (!config) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    // Fetch releases from both source and destination
    let sourceReleases: any[] = [];
    let destReleases: any[] = [];
    let sourceError: string | null = null;
    let destError: string | null = null;

    try {
      sourceReleases = await fetchGitHubReleases(
        config.sourceToken,
        config.sourceRepoOwner,
        config.sourceRepoName
      );
    } catch (err: any) {
      sourceError = err.message || String(err);
    }

    try {
      destReleases = await fetchGitHubReleases(
        config.destToken,
        config.destRepoOwner,
        config.destRepoName
      );
    } catch (err: any) {
      destError = err.message || String(err);
    }

    // Create a lookup for destination releases by tag
    const destTagsMap = new Map<string, any>();
    destReleases.forEach(r => {
      destTagsMap.set(r.tag_name, r);
    });

    // Merge information
    const comparison = sourceReleases.map(src => {
      const destRelease = destTagsMap.get(src.tag_name);
      return {
        tag_name: src.tag_name,
        name: src.name,
        body: src.body,
        draft: src.draft,
        prerelease: src.prerelease,
        created_at: src.created_at,
        published_at: src.published_at,
        assets: src.assets.map((a: any) => ({
          id: a.id,
          name: a.name,
          size: a.size,
          content_type: a.content_type,
          browser_download_url: a.browser_download_url
        })),
        isSynced: !!destRelease,
        destReleaseDetails: destRelease ? {
          id: destRelease.id,
          name: destRelease.name,
          published_at: destRelease.published_at,
          assets: destRelease.assets.map((a: any) => ({
            id: a.id,
            name: a.name,
            size: a.size
          }))
        } : null
      };
    });

    return NextResponse.json({
      configName: config.name,
      sourceRepo: `${config.sourceRepoOwner}/${config.sourceRepoName}`,
      destRepo: `${config.destRepoOwner}/${config.destRepoName}`,
      sourceError,
      destError,
      releases: comparison,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to compare releases' }, { status: 500 });
  }
}

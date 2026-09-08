import { NextResponse } from 'next/server';
import { db } from '@/db';
import { syncConfigs } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const configs = db
      .select()
      .from(syncConfigs)
      .orderBy(desc(syncConfigs.createdAt))
      .all();
    return NextResponse.json(configs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch configs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      sourceRepoOwner,
      sourceRepoName,
      sourceToken,
      destRepoOwner,
      destRepoName,
      destToken,
      active,
      assetFilter,
      updateReadme,
    } = body;

    if (!name || !sourceRepoOwner || !sourceRepoName || !sourceToken || !destRepoOwner || !destRepoName || !destToken) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const newConfig = db
      .insert(syncConfigs)
      .values({
        name,
        sourceRepoOwner: sourceRepoOwner.trim(),
        sourceRepoName: sourceRepoName.trim(),
        sourceToken: sourceToken.trim(),
        destRepoOwner: destRepoOwner.trim(),
        destRepoName: destRepoName.trim(),
        destToken: destToken.trim(),
        active: active !== undefined ? active : true,
        assetFilter: assetFilter !== undefined && assetFilter !== null ? String(assetFilter).trim() : '.exe',
        updateReadme: updateReadme !== undefined ? !!updateReadme : true,
      })
      .returning()
      .get();

    return NextResponse.json(newConfig);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create config' }, { status: 500 });
  }
}

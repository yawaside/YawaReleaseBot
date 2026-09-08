import { NextResponse } from 'next/server';
import { db } from '@/db';
import { syncConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const configId = parseInt(id, 10);
    if (isNaN(configId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const updatedConfig = db
      .update(syncConfigs)
      .set({
        name,
        sourceRepoOwner: sourceRepoOwner ? sourceRepoOwner.trim() : undefined,
        sourceRepoName: sourceRepoName ? sourceRepoName.trim() : undefined,
        sourceToken: sourceToken ? sourceToken.trim() : undefined,
        destRepoOwner: destRepoOwner ? destRepoOwner.trim() : undefined,
        destRepoName: destRepoName ? destRepoName.trim() : undefined,
        destToken: destToken ? destToken.trim() : undefined,
        active: active !== undefined ? active : undefined,
        assetFilter: assetFilter !== undefined && assetFilter !== null ? String(assetFilter).trim() : undefined,
        updateReadme: updateReadme !== undefined ? !!updateReadme : undefined,
        updatedAt: new Date(),
      })
      .where(eq(syncConfigs.id, configId))
      .returning()
      .get();

    if (!updatedConfig) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    return NextResponse.json(updatedConfig);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update config' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const configId = parseInt(id, 10);
    if (isNaN(configId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const deletedConfig = db
      .delete(syncConfigs)
      .where(eq(syncConfigs.id, configId))
      .returning()
      .get();

    if (!deletedConfig) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Config deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete config' }, { status: 500 });
  }
}

import { Buffer } from 'buffer';

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  assets: Array<{
    id: number;
    name: string;
    size: number;
    content_type: string;
    browser_download_url: string;
    url: string;
  }>;
}

/**
 * Tests if the token is valid and can access the given repository.
 */
export async function testGitHubConnection(token: string, owner: string, repo: string): Promise<{ success: boolean; message: string; scopes?: string[] }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'GitHub-Release-Sync-Bot-App'
      },
      cache: 'no-store'
    });

    if (res.status === 200) {
      const data = await res.json();
      const scopesHeader = res.headers.get('x-oauth-scopes');
      const scopes = scopesHeader ? scopesHeader.split(',').map(s => s.trim()) : [];
      
      // Check if we have repo scope or write/read access
      return { 
        success: true, 
        message: `Successfully connected! Repository: ${data.full_name}. Permissions: ${data.permissions ? JSON.stringify(data.permissions) : 'N/A'}`,
        scopes 
      };
    } else {
      const errorData = await res.json().catch(() => ({ message: res.statusText }));
      return { 
        success: false, 
        message: `Connection failed (Status ${res.status}): ${errorData.message}` 
      };
    }
  } catch (error: any) {
    return { 
      success: false, 
      message: `Network error or invalid URL: ${error.message || error}` 
    };
  }
}

/**
 * Lists releases from a repository.
 */
export async function fetchGitHubReleases(token: string, owner: string, repo: string): Promise<GitHubRelease[]> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=50`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'GitHub-Release-Sync-Bot-App'
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Failed to fetch releases (${res.status}): ${errorData.message}`);
  }

  return await res.json() as GitHubRelease[];
}

/**
 * Deletes a release if it exists in the destination repository.
 * Useful for overwriting/re-syncing.
 */
export async function deleteReleaseIfExists(token: string, owner: string, repo: string, tagName: string): Promise<boolean> {
  try {
    // 1. Get the release by tag
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tagName}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'GitHub-Release-Sync-Bot-App'
      },
      cache: 'no-store'
    });

    if (getRes.status === 404) {
      return false; // Not found, nothing to delete
    }

    if (!getRes.ok) {
      return false;
    }

    const releaseData = await getRes.json();
    const releaseId = releaseData.id;

    // 2. Delete release
    const delRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'GitHub-Release-Sync-Bot-App'
      }
    });

    // 3. Delete tag ref optionally to allow ref recreation
    await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/tags/${tagName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'GitHub-Release-Sync-Bot-App'
      }
    });

    return delRes.status === 204;
  } catch (err) {
    console.error('Error deleting release/tag:', err);
    return false;
  }
}

/**
 * Download a private asset binary content as Buffer.
 */
export async function downloadAsset(token: string, assetUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(assetUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/octet-stream',
      'User-Agent': 'GitHub-Release-Sync-Bot-App'
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`Failed to download asset from ${assetUrl} (Status ${res.status})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType
  };
}

/**
 * Upload an asset buffer to a destination release.
 */
export async function uploadAsset(
  token: string,
  owner: string,
  repo: string,
  releaseId: number,
  assetName: string,
  contentType: string,
  buffer: Buffer
): Promise<any> {
  const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`;
  
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': contentType,
      'Content-Length': buffer.length.toString(),
      'User-Agent': 'GitHub-Release-Sync-Bot-App'
    },
    body: new Uint8Array(buffer) as any
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to upload asset "${assetName}" (Status ${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * Parse a comma-separated extension filter string into a normalized list.
 * e.g. ".exe, MSI , .zip" => ['.exe', '.msi', '.zip']
 */
export function parseAssetFilter(filter: string): string[] {
  if (!filter || !filter.trim()) return [];
  return filter
    .split(',')
    .map(ext => ext.trim().toLowerCase())
    .filter(Boolean)
    .map(ext => (ext.startsWith('.') ? ext : `.${ext}`));
}

/**
 * Returns true if the asset filename matches one of the allowed extensions.
 * If the filter list is empty, everything is allowed.
 */
export function assetMatchesFilter(fileName: string, allowedExtensions: string[]): boolean {
  if (allowedExtensions.length === 0) return true;
  const lower = fileName.toLowerCase();
  return allowedExtensions.some(ext => lower.endsWith(ext));
}

/**
 * Creates or updates the README.md file in the destination repository using
 * the release changelog/body. Uses the Contents API (requires the current sha
 * when updating an existing file).
 */
export async function updateDestinationReadme(options: {
  token: string;
  owner: string;
  repo: string;
  tagName: string;
  releaseName: string;
  body: string;
  syncedFiles: Array<{ name: string; size: number }>;
}): Promise<{ success: boolean; message: string }> {
  const { token, owner, repo, tagName, releaseName, body, syncedFiles } = options;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'GitHub-Release-Sync-Bot-App'
  };

  // Build README content from the changelog.
  const filesTable = syncedFiles.length
    ? syncedFiles.map(f => `- \`${f.name}\` (${(f.size / 1024 / 1024).toFixed(2)} MB)`).join('\n')
    : '_No binary files attached to this release._';

  const readmeContent = `# ${repo}

> Latest release: **${releaseName || tagName}** (\`${tagName}\`)
> Automatically published by GitHub Release Sync Bot on ${new Date().toISOString().split('T')[0]}.

## 📥 Downloads

${filesTable}

Get all builds on the [Releases page](https://github.com/${owner}/${repo}/releases).

## 📝 Changelog

${body && body.trim() ? body : '_No changelog provided for this release._'}

---
_This README is generated automatically from the source repository's release notes. Source code is not published here — binaries only._
`;

  const contentBase64 = Buffer.from(readmeContent, 'utf-8').toString('base64');

  try {
    // 1. Check if README.md already exists to get its sha
    let existingSha: string | undefined;
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/README.md`, {
      headers,
      cache: 'no-store'
    });
    if (getRes.status === 200) {
      const existing = await getRes.json();
      existingSha = existing.sha;
    }

    // 2. Create or update
    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/README.md`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `docs: update README for release ${tagName}`,
        content: contentBase64,
        ...(existingSha ? { sha: existingSha } : {})
      })
    });

    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({ message: putRes.statusText }));
      return { success: false, message: `Failed to update README (${putRes.status}): ${errData.message}` };
    }

    return { success: true, message: 'README.md updated successfully from changelog.' };
  } catch (error: any) {
    return { success: false, message: `Error updating README: ${error.message || error}` };
  }
}

/**
 * Synchronizes a specific release from Source to Destination.
 */
export async function syncSingleRelease(options: {
  source: { owner: string; repo: string; token: string };
  dest: { owner: string; repo: string; token: string };
  tagName: string;
  overwrite: boolean;
  assetFilter?: string;
  updateReadme?: boolean;
  onProgress?: (msg: string) => void;
}): Promise<{
  success: boolean;
  syncedAssets: Array<{ name: string; size: number }>;
  skippedAssets: Array<{ name: string; size: number }>;
  readmeUpdated: boolean;
  message: string;
}> {
  const { source, dest, tagName, overwrite, onProgress } = options;
  const allowedExtensions = parseAssetFilter(options.assetFilter ?? '.exe');
  const shouldUpdateReadme = options.updateReadme ?? true;
  const log = (msg: string) => {
    console.log(`[Sync ${tagName}]: ${msg}`);
    if (onProgress) onProgress(msg);
  };

  try {
    log('Fetching details of source release...');
    const sourceReleases = await fetchGitHubReleases(source.token, source.owner, source.repo);
    const sourceRelease = sourceReleases.find(r => r.tag_name === tagName);

    if (!sourceRelease) {
      throw new Error(`Release with tag "${tagName}" not found in source repository.`);
    }

    log(`Found source release "${sourceRelease.name || tagName}". Asset count: ${sourceRelease.assets.length}`);
    log(`Applying asset filter: ${allowedExtensions.length ? allowedExtensions.join(', ') : '(all files allowed)'}`);

    if (overwrite) {
      log('Overwrite option is enabled. Checking and removing existing release on destination...');
      const deleted = await deleteReleaseIfExists(dest.token, dest.owner, dest.repo, tagName);
      if (deleted) {
        log('Deleted existing release and tag on destination.');
      } else {
        log('No pre-existing release found to delete or delete was not needed.');
      }
    }

    // Create release on destination
    log('Creating release on destination repository...');
    const createRes = await fetch(`https://api.github.com/repos/${dest.owner}/${dest.repo}/releases`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dest.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Release-Sync-Bot-App'
      },
      body: JSON.stringify({
        tag_name: sourceRelease.tag_name,
        name: sourceRelease.name || sourceRelease.tag_name,
        body: sourceRelease.body || `Synced from ${source.owner}/${source.repo}@${sourceRelease.tag_name}`,
        draft: sourceRelease.draft,
        prerelease: sourceRelease.prerelease,
        make_latest: 'true'
      })
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({ message: createRes.statusText }));
      throw new Error(`Failed to create release on destination (${createRes.status}): ${errData.message}`);
    }

    const createdRelease = await createRes.json();
    const destReleaseId = createdRelease.id;
    log(`Successfully created destination release. ID: ${destReleaseId}`);

    const syncedAssets: Array<{ name: string; size: number }> = [];
    const skippedAssets: Array<{ name: string; size: number }> = [];

    // Transfer each asset that matches the filter
    for (const asset of sourceRelease.assets) {
      if (!assetMatchesFilter(asset.name, allowedExtensions)) {
        log(`Skipping "${asset.name}" — does not match asset filter.`);
        skippedAssets.push({ name: asset.name, size: asset.size });
        continue;
      }
      log(`Downloading asset "${asset.name}" (${(asset.size / 1024 / 1024).toFixed(2)} MB)...`);
      const { buffer, contentType } = await downloadAsset(source.token, asset.url);
      log(`Downloaded "${asset.name}". Now uploading to destination release...`);
      await uploadAsset(dest.token, dest.owner, dest.repo, destReleaseId, asset.name, contentType, buffer);
      log(`Uploaded asset "${asset.name}" successfully.`);
      syncedAssets.push({ name: asset.name, size: asset.size });
    }

    // Update README.md based on changelog if enabled
    let readmeUpdated = false;
    if (shouldUpdateReadme) {
      log('Updating destination README.md from changelog...');
      const readmeResult = await updateDestinationReadme({
        token: dest.token,
        owner: dest.owner,
        repo: dest.repo,
        tagName: sourceRelease.tag_name,
        releaseName: sourceRelease.name || sourceRelease.tag_name,
        body: sourceRelease.body || '',
        syncedFiles: syncedAssets
      });
      readmeUpdated = readmeResult.success;
      log(readmeResult.message);
    }

    log('Synchronization complete!');
    const parts = [`Synced ${syncedAssets.length} file(s)`];
    if (skippedAssets.length) parts.push(`skipped ${skippedAssets.length} file(s) by filter`);
    if (readmeUpdated) parts.push('README updated');
    return {
      success: true,
      syncedAssets,
      skippedAssets,
      readmeUpdated,
      message: `Release ${tagName} synchronized. ${parts.join(', ')}.`
    };
  } catch (error: any) {
    console.error('Error during synchronization:', error);
    return {
      success: false,
      syncedAssets: [],
      skippedAssets: [],
      readmeUpdated: false,
      message: error.message || String(error)
    };
  }
}

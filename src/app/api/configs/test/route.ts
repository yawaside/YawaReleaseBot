import { NextResponse } from 'next/server';
import { testGitHubConnection } from '@/lib/github';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, owner, repo } = body;

    if (!token || !owner || !repo) {
      return NextResponse.json({ success: false, message: 'Missing token, owner, or repo' }, { status: 400 });
    }

    const result = await testGitHubConnection(token.trim(), owner.trim(), repo.trim());
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Internal error testing connection' }, { status: 500 });
  }
}

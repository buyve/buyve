import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const landingPagePath = path.join(process.cwd(), 'landingpage', 'index.html');

const replacements: Array<[string, string]> = [
  ['href="css/', 'href="/landingpage/css/'],
  ['src="css/', 'src="/landingpage/css/'],
  ['src="images/', 'src="/landingpage/images/'],
  ['href="images/', 'href="/landingpage/images/'],
  ['srcset="images/', 'srcset="/landingpage/images/'],
  ['data-src="images/', 'data-src="/landingpage/images/'],
  [', images/', ', /landingpage/images/'],
  [' images/', ' /landingpage/images/'],
  ['src="js/', 'src="/landingpage/js/'],
  ['href="js/', 'href="/landingpage/js/'],
  ['href="fonts/', 'href="/landingpage/fonts/'],
  ['url(images/', 'url(/landingpage/images/'],
  ['url("images/', 'url("/landingpage/images/'],
  ["href=\"index.html\"", 'href="/"'],
];

export const dynamic = 'force-static';

export async function GET() {
  let html = await fs.readFile(landingPagePath, 'utf-8');

  for (const [searchValue, replaceValue] of replacements) {
    html = html.split(searchValue).join(replaceValue);
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

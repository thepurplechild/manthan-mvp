export function GET() {
  const body = `User-agent: *
Allow: /
Sitemap: https://manthan-mvp-v10.vercel.app/sitemap.xml
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
}


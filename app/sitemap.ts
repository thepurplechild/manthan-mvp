export default async function sitemap() {
  const base = 'https://manthan-mvp-v10.vercel.app'
  const routes = ['/', '/features', '/pricing', '/about', '/contact', '/login', '/signup', '/privacy', '/terms', '/cookies']
  return routes.map((r) => ({ url: `${base}${r}`, lastModified: new Date() }))
}


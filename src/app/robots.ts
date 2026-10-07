import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/login', '/portal/', '/api/'],
      },
    ],
    sitemap: 'https://thetrustworthyschools.com/sitemap.xml',
    host: 'https://thetrustworthyschools.com',
  }
}
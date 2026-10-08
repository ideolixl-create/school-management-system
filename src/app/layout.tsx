import './globals.css'
import type { Metadata, Viewport } from 'next'

const SITE_URL = 'https://www.thetrustworthyschools.com'
const LOGO_URL =
  'https://raw.githubusercontent.com/ideolixlearninghub/Trustworthy_schoolsexam/main/The%20trustworthy%20school%20logo.jpg'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'The Trustworthy Schools — Nurture for Piety | Mowe, Ogun State',
    template: '%s | The Trustworthy Schools',
  },
  description:
    'The Trustworthy Schools, Mowe, Ogun State. Quality Islamic & Western education from Preschool to SS3. Computer-Based Testing (CBT) exams, vocational training, and Qur\'anic foundation. Enrolling now.',
  keywords: [
    'The Trustworthy Schools',
    'Trustworthy Schools Mowe',
    'school in Mowe',
    'school in Ogun State',
    'Islamic school Ogun',
    "Qur'anic school Mowe",
    'private school Orimerunmu',
    'primary school Mowe',
    'secondary school Ogun',
    'CBT school Nigeria',
    'WAEC CBT school',
  ],
  authors: [{ name: 'The Trustworthy Schools' }],
  creator: 'The Trustworthy Schools',
  publisher: 'The Trustworthy Schools',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: SITE_URL,
    siteName: 'The Trustworthy Schools',
    title: 'The Trustworthy Schools — Nurture for Piety',
    description:
      'Quality Islamic & Western education in Mowe, Ogun State. Preschool to SS3. Enrolling now.',
    images: [
      {
        url: LOGO_URL,
        width: 800,
        height: 800,
        alt: 'The Trustworthy Schools logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Trustworthy Schools — Nurture for Piety',
    description: 'Quality Islamic & Western education in Mowe, Ogun State.',
    images: [LOGO_URL],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
   icon: [
    { url: '/favicon.ico', sizes: 'any' },
    { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    { url: '/android-chrome-192x192.png', type: 'image/png', sizes: '192x192' },
  ],
  apple: '/apple-touch-icon.png',
},
  verification: {
    // Add your Google Search Console verification code here later
    // google: 'your-verification-code',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4A2E1B',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'School',
    name: 'The Trustworthy Schools',
    alternateName: 'TTS',
    slogan: 'Nurture for Piety',
    url: SITE_URL,
    logo: LOGO_URL,
    image: LOGO_URL,
    email: 'trustworthysch16@gmail.com',
    telephone: '+2348037376160',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '1, CTCS Avenue, Coca Cola Junction, Unity Estate',
      addressLocality: 'Orimerunmu Mowe',
      addressRegion: 'Ogun State',
      addressCountry: 'NG',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 6.8467,
      longitude: 3.4597,
    },
    areaServed: ['Mowe', 'Orimerunmu', 'Ogun State', 'Nigeria'],
    sameAs: [],
  }

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-[#FDFBF7] font-sans antialiased text-gray-900">
        {children}
      </body>
    </html>
  )
}
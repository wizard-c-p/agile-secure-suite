/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: false, // Kaynak kodları gizle
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive' // Arama motorlarına: "Beni Unut"
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY' // Iframe içine alınmayı engelle (Clickjacking koruması)
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // /index.html и / — одна и та же страница; для поисковиков оставляем
  // один адрес, иначе главная индексируется дважды.
  async redirects() {
    return [{ source: "/index.html", destination: "/", permanent: true }]
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Корень отдаёт статический лендинг из /public/index.html
        { source: "/", destination: "/index.html" },
      ],
    }
  },
}

export default nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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

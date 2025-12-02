/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: false, // 启用TypeScript错误检查
  },
  // 启用React严格模式以获得更好的性能和错误检测
  reactStrictMode: true,
  eslint: {
    // 构建时检查ESLint错误
    ignoreDuringBuilds: false,
  },
  // 优化性能配置
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // 启用压缩
  compress: true,
  // 优化图片
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  // 重定向配置
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/login',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
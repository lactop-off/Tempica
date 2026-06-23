/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // バックエンド API をフロント同一オリジンの /api/v1 にプロキシ（セッション Cookie 共有のため）
  async rewrites() {
    const target = process.env.BACKEND_ORIGIN || 'http://localhost:3000';
    return [{ source: '/api/v1/:path*', destination: `${target}/api/v1/:path*` }];
  },
};
export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 优化Vercel部署
  serverExternalPackages: ['mongoose'],
  
  // 图片配置
  images: {
    domains: ['lh3.googleusercontent.com'], // Google头像域名
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // 环境变量
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  }
};

export default nextConfig;

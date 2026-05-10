/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        { module: /dpopUtils\.js/ },
        { module: /jose\/dist\/webapi/ },
      ];
    }
    return config;
  },
};

export default nextConfig;

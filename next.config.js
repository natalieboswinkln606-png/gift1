/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ['three', 'gsap'],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      use: 'raw-loader'
    })
    // 将 three/gsap 分离为独立 chunk，避免重复打包
    if (!config.optimization.splitChunks) {
      config.optimization.splitChunks = { cacheGroups: {} }
    }
    config.optimization.splitChunks.cacheGroups = {
      ...config.optimization.splitChunks.cacheGroups,
      three: {
        test: /[\\/]node_modules[\\/]three[\\/]/,
        name: 'three',
        chunks: 'all',
        priority: 20,
      },
      gsap: {
        test: /[\\/]node_modules[\\/]gsap[\\/]/,
        name: 'gsap',
        chunks: 'all',
        priority: 20,
      },
    }
    return config
  }
}

module.exports = nextConfig

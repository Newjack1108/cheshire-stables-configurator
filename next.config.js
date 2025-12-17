/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Railway compatibility
  experimental: {
    outputFileTracingIncludes: {
      '/configurator': ['./lib/**/*', './components/**/*'],
    },
  },
}

module.exports = nextConfig


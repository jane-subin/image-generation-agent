/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Local Node.js isn't available in this environment to run lint before pushing,
    // so lint errors shouldn't block a production build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig: any = {
  reactCompiler: true,
  transpilePackages: ['@shopify/polaris', '@shopify/polaris-icons'],
  serverExternalPackages: ['firebase-admin', 'firebase-admin/app', 'firebase-admin/auth', 'mercadopago', 'jspdf', 'jspdf-autotable', 'fflate'],
  compress: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizePackageImports: ['@shopify/polaris', '@shopify/polaris-icons', 'lucide-react', 'date-fns', 'recharts'],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;

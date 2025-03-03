import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rqsfebcljeizuojtkabi.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
};

export default nextConfig;

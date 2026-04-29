import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['yahoo-finance2', 'smtp-server', 'mailparser'],
};

export default nextConfig;

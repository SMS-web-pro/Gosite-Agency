import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg utilise des bindings Node natifs — ne pas les bundler côté serveur
  serverExternalPackages: ["pg"],
};

export default nextConfig;

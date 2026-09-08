import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Generates a minimal `standalone` output folder — enables the
  // GitHub Actions release pipeline to package a runnable artifact.
  output: 'standalone',

  // better-sqlite3 is a native module: keep it external so Next copies the
  // whole package (including the platform .node binary) into the standalone
  // bundle instead of bundling it.
  serverExternalPackages: ['better-sqlite3'],

  // Belt-and-suspenders: make sure the native binary is traced for routes.
  outputFileTracingIncludes: {
    '/**/*': ['./node_modules/better-sqlite3/**/*'],
  },
};

export default nextConfig;

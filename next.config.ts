import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this project. Without it, Turbopack walks up
    // and finds an unrelated package-lock.json in the parent directory, which
    // makes module resolution depend on files outside the repository.
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;

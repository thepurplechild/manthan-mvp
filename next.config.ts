import type { NextConfig } from "next";
// Validate environment at boot time
import './lib/env'

const nextConfig: NextConfig = {
  eslint: {
    // Ignore ESLint errors during build for production deployment
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Configure webpack to handle Node.js-only modules
    if (!isServer) {
      // Exclude server-only modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        crypto: false,
        buffer: false,
        util: false,
        zlib: false,
      };
      
      // Ignore server-only packages in client bundle
      config.externals = config.externals || [];
      config.externals.push({
        'pdf-parse': 'commonjs pdf-parse',
        'adm-zip': 'commonjs adm-zip',
        'mammoth': 'commonjs mammoth',
        'yauzl': 'commonjs yauzl',
      });
    }
    
    return config;
  },
  
  // Ensure API routes run in Node.js runtime  
  serverExternalPackages: [
    'pdf-parse',
    'adm-zip', 
    'mammoth',
    'yauzl',
    'fast-xml-parser',
    'xml2js',
    '@anthropic-ai/sdk',
    'officegen',
    'pdf-lib',
    'jspdf',
    'docx',
    'pdfjs-dist',
    'canvas',
    'tesseract.js',
    'pptxgenjs',
    '@react-pdf/renderer',
    'react-pdf'
  ],
};

export default nextConfig;

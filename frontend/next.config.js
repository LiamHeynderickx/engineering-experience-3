/** @type {import('next').NextConfig} */
const nextConfig = {
    // you can still enable other Next.js experimental flags here
    experimental: {
      // (you probably don't need webpack5: Next.js 12+ uses it by default)
      // webpack5: true,
    },
  
    webpack(config) {
      // turn on async WASM support
      config.experiments = config.experiments || {};
      config.experiments.asyncWebAssembly = true;
  
      // tell webpack how to load .wasm files
      config.module.rules.push({
        test: /\.wasm$/,
        type: "webassembly/async",
      });
  
      return config;
    },
  };
  
  module.exports = nextConfig;
  
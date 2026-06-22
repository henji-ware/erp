/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove o indicador/dev tools do Next (a bolinha com "N").
  devIndicators: false,
  // Permite anexar arquivos maiores (propostas em PDF/Word) via Server Actions.
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;

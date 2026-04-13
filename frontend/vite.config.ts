import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const certPath = process.env.SSL_CERT_FILE ?? path.resolve(__dirname, "./certs/localhost-cert.pem");
  const keyPath = process.env.SSL_KEY_FILE ?? path.resolve(__dirname, "./certs/localhost-key.pem");
  const httpsEnabled = process.env.DEV_HTTPS === "true";

  let httpsConfig: { key: Buffer; cert: Buffer } | undefined;
  if (httpsEnabled) {
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(
        `DEV_HTTPS=true pero no se encontraron certificados SSL.\n` +
          `Esperado:\n- cert: ${certPath}\n- key: ${keyPath}\n` +
          `Ejecuta: npm run cert:generate`,
      );
    }

    httpsConfig = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  }

  return {
    server: {
      host: "::",
      port: 8081,
      https: httpsConfig,
      proxy: {
        "/api": {
          target: process.env.VITE_DEV_API_PROXY_TARGET ?? "http://localhost:8000",
          changeOrigin: true,
          secure: false,
        },
      },
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Configuração do servidor de desenvolvimento
  const serverConfig: any = {
    host: "::",
    port: 8080,
    strictPort: true,
    hmr: {
      port: 8081,
    },
  };

  // Adicionar HTTPS apenas em desenvolvimento local
  if (mode === "development") {
    const keyPath = './localhost-key.pem';
    const certPath = './localhost.pem';
    
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      try {
        serverConfig.https = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        };
        console.log('🔒 HTTPS habilitado com certificados locais');
        console.log('⚠️  Se o Chrome mostrar erro SSL, você pode:');
        console.log('   1. Aceitar o certificado (avançado > continuar)');
        console.log('   2. Ou usar HTTP: remova os arquivos .pem e reinicie');
        console.log('   3. Ou use mkcert para certificados confiáveis');
      } catch (error) {
        console.warn('⚠️ Erro ao carregar certificados SSL, usando HTTP:', error);
      }
    } else {
      console.log('ℹ️ Certificados SSL não encontrados. Usando HTTP.');
      console.log('💡 Para usar HTTPS, execute: npm run generate-ssl');
      console.log('   Ou use: npm run dev:https (gera certificados automaticamente)');
    }
  }

  return {
    server: serverConfig,
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

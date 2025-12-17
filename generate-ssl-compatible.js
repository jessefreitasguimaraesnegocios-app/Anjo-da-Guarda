import { execSync } from 'child_process';
import fs from 'fs';

console.log('🔐 Gerando certificados SSL compatíveis...');

// Função para encontrar o OpenSSL no Windows
function findOpenSSL() {
  const commonPaths = [
    'openssl', // Se estiver no PATH
    'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
    'C:\\Program Files\\OpenSSL-Win32\\bin\\openssl.exe',
    'C:\\OpenSSL-Win64\\bin\\openssl.exe',
    'C:\\OpenSSL-Win32\\bin\\openssl.exe',
  ];

  for (const opensslPath of commonPaths) {
    try {
      execSync(`"${opensslPath}" version`, { stdio: 'ignore' });
      return opensslPath;
    } catch (error) {
      continue;
    }
  }
  return null;
}

try {
  // Verificar se OpenSSL está disponível
  const opensslPath = findOpenSSL();
  if (!opensslPath) {
    console.log('❌ OpenSSL não encontrado.');
    console.log('💡 Instale o OpenSSL ou adicione ao PATH:');
    console.log('   https://slproweb.com/products/Win32OpenSSL.html');
    process.exit(1);
  }
  
  console.log(`✅ OpenSSL encontrado: ${opensslPath}`);

  // Gerar chave privada
  console.log('📝 Gerando chave privada...');
  execSync(`"${opensslPath}" genrsa -out localhost-key.pem 2048`, { stdio: 'inherit' });

  // Criar arquivo de configuração com extensões corretas para Chrome
  const configContent = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no
x509_extensions = v3_req

[req_distinguished_name]
C = BR
ST = SP
L = São Paulo
O = Anjo da Guarda
OU = Development
CN = localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names
authorityKeyIdentifier = keyid,issuer

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = 192.168.18.94
IP.1 = 127.0.0.1
IP.2 = ::1
IP.3 = 192.168.18.94
`;

  fs.writeFileSync('localhost.conf', configContent);

  // Gerar certificado com extensões corretas
  console.log('📜 Gerando certificado...');
  execSync(`"${opensslPath}" req -new -x509 -key localhost-key.pem -out localhost.pem -days 365 -config localhost.conf -extensions v3_req -sha256`, { stdio: 'inherit' });

  // Limpar arquivo de configuração
  fs.unlinkSync('localhost.conf');

  console.log('✅ Certificados SSL compatíveis gerados com sucesso!');
  console.log('📁 Arquivos criados:');
  console.log('   - localhost-key.pem (chave privada)');
  console.log('   - localhost.pem (certificado)');
  console.log('');
  console.log('🚀 Agora reinicie o servidor com: npm run dev');

} catch (error) {
  console.error('❌ Erro ao gerar certificados:', error.message);
  console.log('💡 Usando certificados autoassinados do Vite...');
}

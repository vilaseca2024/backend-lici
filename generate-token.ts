/**
 * Script para generar token.json de Google OAuth2
 * Ejecutar UNA SOLA VEZ con: npx ts-node generate-token.ts
 */
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as dotenv from 'dotenv';

dotenv.config();

const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function main() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('❌ Faltan variables en .env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI');
    process.exit(1);
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',   // fuerza que devuelva refresh_token
    scope: SCOPES,
  });

  console.log('\n🔗 Abre esta URL en tu navegador:\n');
  console.log(authUrl);
  console.log('\n⚠️  Después de autorizar, el navegador te redirigirá a:');
  console.log(`   ${redirectUri}?code=XXXXXX`);
  console.log('   Copia solo el valor del parámetro "code" de esa URL\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question('📋 Pega aquí el código (solo el valor de "code"): ', async (code) => {
    rl.close();
    try {
      const { tokens } = await oAuth2Client.getToken(code.trim());
      oAuth2Client.setCredentials(tokens);

      const dir = path.dirname(TOKEN_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log(`\n✅ Token guardado en: ${TOKEN_PATH}`);
      console.log('   Ya puedes iniciar NestJS.\n');
    } catch (error) {
      console.error('❌ Error obteniendo el token:', error.message);
      console.error('   Asegúrate de copiar solo el valor del parámetro "code", sin el resto de la URL.');
    }
  });
}

main();
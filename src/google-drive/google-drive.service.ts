import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3, Auth } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GoogleDriveService implements OnModuleInit {
  private drive: drive_v3.Drive;
  private oAuth2Client: Auth.OAuth2Client;
  private readonly logger = new Logger(GoogleDriveService.name);
  private readonly TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token.json');

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeDrive();
  }

  private async initializeDrive() {
    try {
      const clientId     = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
      const redirectUri  = this.configService.get<string>('GOOGLE_REDIRECT_URI');

      this.oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

      if (!fs.existsSync(this.TOKEN_PATH)) {
        this.logger.warn('⚠️  No se encontró credentials/token.json — ejecuta: npx ts-node generate-token.ts');
        return;
      }

      const token = JSON.parse(fs.readFileSync(this.TOKEN_PATH, 'utf-8'));
      this.oAuth2Client.setCredentials(token);

      // Auto-refresh: cuando el access_token expire se renueva solo y guarda el nuevo
      this.oAuth2Client.on('tokens', (tokens) => {
        const current = JSON.parse(fs.readFileSync(this.TOKEN_PATH, 'utf-8'));
        fs.writeFileSync(this.TOKEN_PATH, JSON.stringify({ ...current, ...tokens }, null, 2));
        this.logger.log('🔄 Token de Google Drive renovado automáticamente');
      });

      this.drive = google.drive({ version: 'v3', auth: this.oAuth2Client });
      this.logger.log('✅ Google Drive autenticado correctamente');
    } catch (error) {
      this.logger.error(`Error inicializando Google Drive: ${error.message}`);
    }
  }

  async getOrCreateFolder(name: string, parentId?: string): Promise<string> {
    try {
      let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
      if (parentId) query += ` and '${parentId}' in parents`;

      const res = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      const files = res.data.files ?? [];

      if (files.length > 0) {
        this.logger.log(`📁 Carpeta existente: "${name}" → ${files[0].id}`);
        return files[0].id!;
      }

      const created = await this.drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          ...(parentId && { parents: [parentId] }),
        },
        fields: 'id',
      });

      this.logger.log(`📁 Carpeta creada: "${name}" → ${created.data.id}`);
      return created.data.id!;
    } catch (error) {
      this.logger.error(`Error en carpeta "${name}": ${error.message}`);
      throw new InternalServerErrorException(`No se pudo crear la carpeta en Google Drive: ${error.message}`);
    }
  }

  getFolderUrl(folderId: string): string {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }

  getFileUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }
}
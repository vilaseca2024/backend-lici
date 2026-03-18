import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;
  private readonly encryptionIv: Buffer;

  constructor(private readonly config: ConfigService) {
    // Obtener KEY e IV del .env
    const keyHex = this.config.get<string>('ENCRYPTION_KEY');
    const ivHex = this.config.get<string>('ENCRYPTION_IV');

    if (!keyHex || !ivHex) {
      throw new Error('ENCRYPTION_KEY y ENCRYPTION_IV deben estar definidas en .env');
    }

    this.encryptionKey = Buffer.from(keyHex, 'hex');
    this.encryptionIv = Buffer.from(ivHex, 'hex');

    // Validar longitudes
    if (this.encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY debe tener 32 bytes (64 caracteres hex)');
    }
    if (this.encryptionIv.length !== 16) {
      throw new Error('ENCRYPTION_IV debe tener 16 bytes (32 caracteres hex)');
    }
  }

  encrypt(text: string): string {
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, this.encryptionIv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decrypt(encryptedText: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      this.encryptionIv,
    );
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
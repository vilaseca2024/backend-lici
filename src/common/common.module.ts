 
import { Module } from '@nestjs/common';
  
import { EncryptionService } from '../common/encryption.service';

@Module({
  providers: [EncryptionService],
  exports: [EncryptionService], // ← debe estar esto
})
export class CommonModule {}
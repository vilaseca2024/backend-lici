import { Test, TestingModule } from '@nestjs/testing';
import { FotosService } from './foto.service';

describe('FotoService', () => {
  let service: FotosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FotosService],
    }).compile();

    service = module.get<FotosService>(FotosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

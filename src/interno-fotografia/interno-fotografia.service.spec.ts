import { Test, TestingModule } from '@nestjs/testing';
import { InternoFotografiaService } from './interno-fotografia.service';

describe('InternoFotografiaService', () => {
  let service: InternoFotografiaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InternoFotografiaService],
    }).compile();

    service = module.get<InternoFotografiaService>(InternoFotografiaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

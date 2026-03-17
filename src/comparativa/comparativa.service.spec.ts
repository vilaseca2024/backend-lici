import { Test, TestingModule } from '@nestjs/testing';
import { ComparativaService } from './comparativa.service';

describe('ComparativaService', () => {
  let service: ComparativaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ComparativaService],
    }).compile();

    service = module.get<ComparativaService>(ComparativaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

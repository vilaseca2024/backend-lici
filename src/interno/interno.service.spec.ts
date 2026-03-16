import { Test, TestingModule } from '@nestjs/testing';
import { InternoService } from './interno.service';

describe('InternoService', () => {
  let service: InternoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InternoService],
    }).compile();

    service = module.get<InternoService>(InternoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

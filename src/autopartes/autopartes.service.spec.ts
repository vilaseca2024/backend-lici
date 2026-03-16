import { Test, TestingModule } from '@nestjs/testing';
import { AutopartesService } from './autopartes.service';

describe('AutopartesService', () => {
  let service: AutopartesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AutopartesService],
    }).compile();

    service = module.get<AutopartesService>(AutopartesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

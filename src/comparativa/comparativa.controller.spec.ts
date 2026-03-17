import { Test, TestingModule } from '@nestjs/testing';
import { ComparativaController } from './comparativa.controller';
import { ComparativaService } from './comparativa.service';

describe('ComparativaController', () => {
  let controller: ComparativaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComparativaController],
      providers: [ComparativaService],
    }).compile();

    controller = module.get<ComparativaController>(ComparativaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

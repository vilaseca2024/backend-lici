import { Test, TestingModule } from '@nestjs/testing';
import { InternoController } from './interno.controller';
import { InternoService } from './interno.service';

describe('InternoController', () => {
  let controller: InternoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternoController],
      providers: [InternoService],
    }).compile();

    controller = module.get<InternoController>(InternoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

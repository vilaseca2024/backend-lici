import { Test, TestingModule } from '@nestjs/testing';
import { InternoFotografiaController } from './interno-fotografia.controller';

describe('InternoFotografiaController', () => {
  let controller: InternoFotografiaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternoFotografiaController],
    }).compile();

    controller = module.get<InternoFotografiaController>(InternoFotografiaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

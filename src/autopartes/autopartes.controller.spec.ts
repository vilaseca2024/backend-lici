import { Test, TestingModule } from '@nestjs/testing';
import { AutopartesController } from './autopartes.controller';

describe('AutopartesController', () => {
  let controller: AutopartesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutopartesController],
    }).compile();

    controller = module.get<AutopartesController>(AutopartesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

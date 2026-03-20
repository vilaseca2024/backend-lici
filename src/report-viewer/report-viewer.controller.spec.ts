import { Test, TestingModule } from '@nestjs/testing';
import { ReportViewerController } from './report-viewer.controller';
import { ReportViewerService } from './report-viewer.service';

describe('ReportViewerController', () => {
  let controller: ReportViewerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportViewerController],
      providers: [ReportViewerService],
    }).compile();

    controller = module.get<ReportViewerController>(ReportViewerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

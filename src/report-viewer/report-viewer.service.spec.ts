import { Test, TestingModule } from '@nestjs/testing';
import { ReportViewerService } from './report-viewer.service';

describe('ReportViewerService', () => {
  let service: ReportViewerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportViewerService],
    }).compile();

    service = module.get<ReportViewerService>(ReportViewerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

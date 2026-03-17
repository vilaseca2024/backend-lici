import { Controller, Get } from '@nestjs/common';
import { ComparativaService } from './comparativa.service';

@Controller('comparativa')
export class ComparativaController {
  constructor(private readonly comparativaService: ComparativaService) {}

  @Get()
  async getComparativa() {
    const data = await this.comparativaService.getComparativa();
    return {
      total: data.length,
      data,
    };
  }
}
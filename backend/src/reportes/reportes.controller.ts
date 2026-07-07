import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { AuthGuard } from '../auth.guard';

@Controller('reportes')
@UseGuards(AuthGuard)
export class ReportesController {
  constructor(private reportesService: ReportesService) {}

  @Get('aging')
  async aging() {
    return this.reportesService.obtenerAging();
  }

  @Get('flujo-caja')
  async flujoCaja() {
    return this.reportesService.obtenerFlujoCaja();
  }

  @Get('impuestos')
  async impuestos(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.reportesService.obtenerResumenImpuestos(fechaInicio, fechaFin);
  }
}

import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { AuthGuard } from '../auth.guard';

@Controller('pagos')
@UseGuards(AuthGuard)
export class PagosController {
  constructor(private pagosService: PagosService) {}

  @Get()
  async listar() {
    return this.pagosService.listarPagos();
  }

  @Post()
  async crear(@Request() req: any, @Body() body: any) {
    return this.pagosService.registrarPago(body, req.user.id);
  }

  @Get('conciliacion')
  async listarConciliaciones() {
    return this.pagosService.listarConciliaciones();
  }

  @Post('conciliacion/linea')
  async crearLineaBanco(@Body() body: any) {
    return this.pagosService.crearLineaBanco(body);
  }

  @Post('conciliacion/conciliar')
  async conciliar(@Request() req: any, @Body() body: any) {
    const { pagoId, lineaBancoId } = body;
    return this.pagosService.conciliarPago(pagoId, lineaBancoId, req.user.id);
  }
}

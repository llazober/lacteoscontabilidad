import { Controller, Get, Post, Param, Body, Request, UseGuards } from '@nestjs/common';
import { FacturasCompraService } from './facturas-compra.service';
import { AuthGuard } from '../auth.guard';

@Controller('facturas-compra')
@UseGuards(AuthGuard)
export class FacturasCompraController {
  constructor(private facturasService: FacturasCompraService) {}

  @Get()
  async listar() {
    return this.facturasService.listarFacturas();
  }

  @Get(':id')
  async obtenerDetalles(@Param('id') id: string) {
    return this.facturasService.obtenerUna(id);
  }

  @Post()
  async crear(@Request() req: any, @Body() body: any) {
    return this.facturasService.crearFactura(body, req.user.id);
  }

  @Post(':id/match-override')
  async matchOverride(@Request() req: any, @Param('id') id: string) {
    return this.facturasService.autorizarMatchManual(id, req.user.id);
  }
}

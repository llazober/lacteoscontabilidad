import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { AuthGuard } from '../auth.guard';

@Controller('proveedores')
@UseGuards(AuthGuard)
export class ProveedoresController {
  constructor(private proveedoresService: ProveedoresService) {}

  @Get('detalles')
  async listarDetalles() {
    return this.proveedoresService.listarDetalles();
  }

  @Get(':id')
  async obtenerUno(@Param('id') id: string) {
    return this.proveedoresService.obtenerUno(id);
  }

  @Put(':id/contabilidad')
  async actualizarContabilidad(@Param('id') id: string, @Body() body: any) {
    return this.proveedoresService.actualizarContabilidad(id, body);
  }
}

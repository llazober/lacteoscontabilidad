import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CuentasService } from './cuentas.service';
import { AuthGuard } from '../auth.guard';

@Controller('contabilidad')
@UseGuards(AuthGuard)
export class CuentasController {
  constructor(private cuentasService: CuentasService) {}

  @Get('cuentas')
  async listarCuentas() {
    return this.cuentasService.obtenerCuentas();
  }

  @Post('cuentas')
  async crearCuenta(@Body() body: any) {
    return this.cuentasService.crearCuenta(body);
  }

  @Put('cuentas/:id')
  async editarCuenta(@Param('id') id: string, @Body() body: any) {
    return this.cuentasService.editarCuenta(id, body);
  }

  @Delete('cuentas/:id')
  async eliminarCuenta(@Param('id') id: string) {
    return this.cuentasService.eliminarCuenta(id);
  }

  @Get('configuracion')
  async obtenerConfiguracion() {
    return this.cuentasService.obtenerConfiguraciones();
  }

  @Post('configuracion')
  async guardarConfiguracion(@Body() body: Record<string, string>) {
    return this.cuentasService.guardarConfiguraciones(body);
  }

  @Get('asientos')
  async listarAsientos() {
    return this.cuentasService.obtenerAsientos();
  }

  @Post('limpiar-pruebas')
  async limpiarPruebas() {
    console.log('[BACKEND DEBUG] Recibida petición POST /contabilidad/limpiar-pruebas');
    return this.cuentasService.limpiarDatosPrueba();
  }
}

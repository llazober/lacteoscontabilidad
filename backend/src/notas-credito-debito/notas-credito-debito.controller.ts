import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { NotasCreditoDebitoService } from './notas-credito-debito.service';
import { AuthGuard } from '../auth.guard';

@Controller('notas-credito-debito')
@UseGuards(AuthGuard)
export class NotasCreditoDebitoController {
  constructor(private notasService: NotasCreditoDebitoService) {}

  @Get()
  async listar() {
    return this.notasService.listarNotas();
  }

  @Post()
  async crear(@Request() req: any, @Body() body: any) {
    return this.notasService.crearNota(body, req.user.id);
  }
}

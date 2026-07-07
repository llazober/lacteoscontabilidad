import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProveedoresService {
  constructor(private prisma: PrismaService) {}

  async listarDetalles() {
    return this.prisma.proveedor.findMany({
      include: {
        terminoPago: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async obtenerUno(id: string) {
    const prov = await this.prisma.proveedor.findUnique({
      where: { id },
      include: {
        terminoPago: true,
      },
    });
    if (!prov) {
      throw new BadRequestException('El proveedor no existe.');
    }
    return prov;
  }

  async actualizarContabilidad(id: string, body: any) {
    const { nit, nrc, tipoContribuyente, limiteCredito, moneda, terminoPagoId } = body;

    const exist = await this.prisma.proveedor.findUnique({
      where: { id },
    });
    if (!exist) {
      throw new BadRequestException('El proveedor no existe.');
    }

    return this.prisma.proveedor.update({
      where: { id },
      data: {
        nit: nit || null,
        nrc: nrc || null,
        tipoContribuyente: tipoContribuyente || null,
        limiteCredito: limiteCredito != null ? parseFloat(limiteCredito) : null,
        moneda: moneda || 'USD',
        terminoPagoId: terminoPagoId || undefined,
      },
    });
  }
}

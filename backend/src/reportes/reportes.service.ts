import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  async obtenerAging() {
    const facturas = await this.prisma.facturaCompra.findMany({
      where: {
        estado: {
          in: ['PENDIENTE', 'APROBADA', 'PAGADA_PARCIAL'],
        },
      },
      include: {
        proveedor: true,
        pagos: true,
      },
    });

    const hoy = new Date();
    const result: Record<string, any> = {};

    for (const f of facturas) {
      const pagado = f.pagos
        .filter((p) => p.estado !== 'ANULADO')
        .reduce((acc, p) => acc + p.monto, 0);
      const saldo = f.total - pagado;

      if (saldo <= 0.01) continue;

      const diffTime = hoy.getTime() - new Date(f.fechaEmision).getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      const provId = f.proveedorId;
      if (!result[provId]) {
        result[provId] = {
          proveedorNombre: f.proveedor.nombre,
          proveedorCodigo: f.proveedor.codigo,
          totalPendiente: 0,
          aging0a30: 0,
          aging31a60: 0,
          aging61a90: 0,
          agingMas90: 0,
        };
      }

      result[provId].totalPendiente += saldo;

      if (diffDays <= 30) {
        result[provId].aging0a30 += saldo;
      } else if (diffDays <= 60) {
        result[provId].aging31a60 += saldo;
      } else if (diffDays <= 90) {
        result[provId].aging61a90 += saldo;
      } else {
        result[provId].agingMas90 += saldo;
      }
    }

    return Object.values(result);
  }

  async obtenerFlujoCaja() {
    const facturas = await this.prisma.facturaCompra.findMany({
      where: {
        estado: {
          in: ['PENDIENTE', 'APROBADA', 'PAGADA_PARCIAL'],
        },
      },
      include: {
        pagos: true,
      },
    });

    const hoy = new Date();
    const result = {
      proximos7Dias: 0,
      proximos15Dias: 0,
      proximos30Dias: 0,
      proximos60Dias: 0,
      vencido: 0,
    };

    for (const f of facturas) {
      const pagado = f.pagos
        .filter((p) => p.estado !== 'ANULADO')
        .reduce((acc, p) => acc + p.monto, 0);
      const saldo = f.total - pagado;

      if (saldo <= 0.01) continue;

      const venc = new Date(f.fechaVencimiento);
      const diffTime = venc.getTime() - hoy.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        result.vencido += saldo;
      } else if (diffDays <= 7) {
        result.proximos7Dias += saldo;
      } else if (diffDays <= 15) {
        result.proximos15Dias += saldo;
      } else if (diffDays <= 30) {
        result.proximos30Dias += saldo;
      } else {
        result.proximos60Dias += saldo;
      }
    }

    return result;
  }

  async obtenerResumenImpuestos(fechaInicioStr?: string, fechaFinStr?: string) {
    const whereClause: any = {};
    if (fechaInicioStr && fechaFinStr) {
      whereClause.fechaEmision = {
        gte: new Date(fechaInicioStr),
        lte: new Date(fechaFinStr),
      };
    }

    const facturas = await this.prisma.facturaCompra.findMany({
      where: whereClause,
    });

    const resumen = {
      totalComprasNetas: 0,
      totalIvaCredito: 0,
      totalRetencionIva: 0,
      totalRetencionRenta: 0,
      totalComprasLiquido: 0,
      cantidadFacturas: facturas.length,
    };

    for (const f of facturas) {
      resumen.totalComprasNetas += f.subtotal;
      resumen.totalIvaCredito += f.iva;
      resumen.totalRetencionIva += f.retencionIva;
      resumen.totalRetencionRenta += f.retencionRenta;
      resumen.totalComprasLiquido += f.total;
    }

    return resumen;
  }
}

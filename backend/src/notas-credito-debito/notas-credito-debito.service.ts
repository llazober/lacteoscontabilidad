import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotasCreditoDebitoService {
  constructor(private prisma: PrismaService) {}

  async listarNotas() {
    return this.prisma.notaCreditoDebito.findMany({
      include: {
        facturaCompra: {
          include: {
            proveedor: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async crearNota(body: any, userId: string) {
    const { tipo, numeroNota, facturaCompraId, monto, concepto, motivo } = body;

    if (!tipo || !numeroNota || !facturaCompraId || monto == null || !concepto) {
      throw new BadRequestException('Todos los campos son obligatorios (tipo, número de nota, factura, monto y concepto).');
    }

    const factura = await this.prisma.facturaCompra.findUnique({
      where: { id: facturaCompraId },
      include: { detalles: true, proveedor: true },
    });
    if (!factura) {
      throw new BadRequestException('La factura referenciada no existe.');
    }

    const montoVal = parseFloat(monto);
    if (montoVal <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero.');
    }

    const notaCreada = await this.prisma.$transaction(async (tx) => {
      // Verificar unicidad
      const exist = await tx.notaCreditoDebito.findUnique({
        where: {
          facturaCompraId_numeroNota: {
            facturaCompraId,
            numeroNota,
          },
        },
      });
      if (exist) {
        throw new BadRequestException('Ya existe una nota de crédito/débito con ese número para esta factura.');
      }

      // Crear nota contable
      const nota = await tx.notaCreditoDebito.create({
        data: {
          tipo,
          numeroNota,
          facturaCompraId,
          monto: montoVal,
          concepto,
          motivo: motivo || null,
        },
      });

      // Actualizar total de la factura en consecuencia
      let nuevoTotalFactura = factura.total;
      if (tipo === 'CREDITO') {
        nuevoTotalFactura = Math.max(0, factura.total - montoVal);
      } else {
        nuevoTotalFactura = factura.total + montoVal;
      }

      // Determinar estado de pago de la factura
      let nuevoEstado = factura.estado;
      if (nuevoTotalFactura <= 0.05) {
        nuevoEstado = 'PAGADA';
      } else if (factura.estado === 'PAGADA' && tipo === 'DEBITO') {
        nuevoEstado = 'PAGADA_PARCIAL';
      }

      await tx.facturaCompra.update({
        where: { id: facturaCompraId },
        data: {
          total: nuevoTotalFactura,
          estado: nuevoEstado,
        },
      });

      // Generar Asiento Contable Automático de Ajuste
      const configList = await tx.configuracionContable.findMany();
      const configMap: Record<string, string> = {};
      for (const c of configList) {
        configMap[c.clave] = c.valor;
      }

      const count = await tx.asientoDiario.count();
      const corr = String(count + 1).padStart(5, '0');
      const anio = new Date().getFullYear();
      const numeroAsiento = `ADI-${tipo === 'CREDITO' ? 'NC' : 'ND'}-${anio}-${corr}`;

      const asiento = await tx.asientoDiario.create({
        data: {
          numero: numeroAsiento,
          concepto: `Ajuste por Nota de ${tipo === 'CREDITO' ? 'Crédito' : 'Débito'} N° ${numeroNota} a Factura N° ${factura.numeroFactura}`,
          fecha: new Date(),
          referencia: nota.id,
          tipoOrigen: tipo === 'CREDITO' ? 'NOTA_CREDITO' : 'NOTA_DEBITO',
          estado: 'POSTEADO',
        },
      });

      // Cuentas contables
      const cuentaCuentasPorPagar = configMap['cuenta_proveedores'] || '2.1.01.01';
      const cuentaIvaCredito = configMap['cuenta_iva_credito'] || '1.1.04.01';
      const cuentaMateriaPrima = configMap['cuenta_inventario_mp'] || '1.1.03.01';
      const cuentaInsumos = configMap['cuenta_inventario_insumos'] || '1.1.03.02';
      const cuentaGastosGenerales = configMap['cuenta_gastos'] || '6.1.01.03';

      // Determinar la cuenta del inventario/gasto
      let cuentaInventarioGasto = cuentaMateriaPrima;
      if (factura.detalles && factura.detalles.length > 0) {
        const prod = await tx.producto.findUnique({ where: { id: factura.detalles[0].productoId } });
        if (prod) {
          if (prod.tipoProducto === 'MATERIA_PRIMA') cuentaInventarioGasto = cuentaMateriaPrima;
          else if (prod.tipoProducto === 'INSUMO') cuentaInventarioGasto = cuentaInsumos;
          else cuentaInventarioGasto = cuentaGastosGenerales;
        }
      }

      const subtotalAjuste = Math.round((montoVal / 1.13) * 100) / 100;
      const ivaAjuste = Math.round((montoVal - subtotalAjuste) * 100) / 100;

      const cCuentasPorPagarDb = await tx.cuentaContable.findUnique({ where: { codigo: cuentaCuentasPorPagar } });
      const cInventarioDb = await tx.cuentaContable.findUnique({ where: { codigo: cuentaInventarioGasto } });
      const cIvaDb = await tx.cuentaContable.findUnique({ where: { codigo: cuentaIvaCredito } });

      if (tipo === 'CREDITO') {
        // NOTA DE CRÉDITO (Reversa saldo y reduce costo de compra)
        // Débito: Cuentas por Pagar (reduce pasivo)
        if (cCuentasPorPagarDb) {
          await tx.lineaAsiento.create({
            data: {
              asientoId: asiento.id,
              cuentaId: cCuentasPorPagarDb.id,
              debe: montoVal,
              haber: 0.0,
              glosa: `Reversión saldo por nota de crédito`,
            },
          });
        }

        // Crédito: Inventario / Costo
        if (cInventarioDb) {
          await tx.lineaAsiento.create({
            data: {
              asientoId: asiento.id,
              cuentaId: cInventarioDb.id,
              debe: 0.0,
              haber: subtotalAjuste,
              glosa: `Ajuste de costo neto de producto`,
            },
          });
        }

        // Crédito: IVA Crédito Fiscal
        if (cIvaDb) {
          await tx.lineaAsiento.create({
            data: {
              asientoId: asiento.id,
              cuentaId: cIvaDb.id,
              debe: 0.0,
              haber: ivaAjuste,
              glosa: `Reversión de IVA Crédito Fiscal`,
            },
          });
        }
      } else {
        // NOTA DE DÉBITO (Incrementa saldo e incrementa costo de compra)
        // Débito: Inventario / Costo
        if (cInventarioDb) {
          await tx.lineaAsiento.create({
            data: {
              asientoId: asiento.id,
              cuentaId: cInventarioDb.id,
              debe: subtotalAjuste,
              haber: 0.0,
              glosa: `Incremento de costo por nota de débito`,
            },
          });
        }

        // Débito: IVA Crédito Fiscal
        if (cIvaDb) {
          await tx.lineaAsiento.create({
            data: {
              asientoId: asiento.id,
              cuentaId: cIvaDb.id,
              debe: ivaAjuste,
              haber: 0.0,
              glosa: `IVA Crédito Fiscal adicional`,
            },
          });
        }

        // Crédito: Cuentas por Pagar (incrementa pasivo)
        if (cCuentasPorPagarDb) {
          await tx.lineaAsiento.create({
            data: {
              asientoId: asiento.id,
              cuentaId: cCuentasPorPagarDb.id,
              debe: 0.0,
              haber: montoVal,
              glosa: `Incremento obligación por pagar`,
            },
          });
        }
      }

      // Guardar asientoId en la nota
      return tx.notaCreditoDebito.update({
        where: { id: nota.id },
        data: { asientoId: asiento.id },
      });
    });

    // Auditoría
    await this.prisma.auditoria.create({
      data: {
        usuarioId: userId,
        accion: `REGISTRAR_NOTA_${tipo}`,
        modulo: 'CONTABILIDAD',
        detalles: JSON.stringify({
          notaId: notaCreada.id,
          facturaId: facturaCompraId,
          monto: montoVal,
        }),
      },
    });

    return notaCreada;
  }
}

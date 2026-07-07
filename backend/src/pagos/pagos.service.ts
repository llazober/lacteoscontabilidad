import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PagosService {
  constructor(private prisma: PrismaService) {}

  async listarPagos() {
    return this.prisma.pagoCompra.findMany({
      include: {
        facturaCompra: {
          include: {
            proveedor: true,
          },
        },
        usuario: true,
      },
      orderBy: { fechaPago: 'desc' },
    });
  }

  async registrarPago(body: any, userId: string) {
    const {
      facturaCompraId,
      monto,
      metodoPago,
      referencia,
      chequeNumero,
      chequeBanco,
      chequeVence,
      transfeCuenta,
    } = body;

    if (!facturaCompraId || monto == null || !metodoPago) {
      throw new BadRequestException('Los campos factura, monto y método de pago son obligatorios.');
    }

    const factura = await this.prisma.facturaCompra.findUnique({
      where: { id: facturaCompraId },
      include: { pagos: true },
    });
    if (!factura) {
      throw new BadRequestException('La factura no existe.');
    }

    if (factura.estado === 'BLOQUEADA_MATCH') {
      throw new BadRequestException('No se pueden registrar pagos a una factura bloqueada por match.');
    }
    if (factura.estado === 'ANULADA') {
      throw new BadRequestException('No se pueden registrar pagos a una factura anulada.');
    }

    const montoVal = parseFloat(monto);
    if (montoVal <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a cero.');
    }

    // Calcular saldo actual de la factura
    const pagosAnteriores = factura.pagos
      .filter((p) => p.estado !== 'ANULADO')
      .reduce((acc, p) => acc + p.monto, 0);

    const saldoRestante = Math.round((factura.total - pagosAnteriores) * 100) / 100;
    if (montoVal > saldoRestante + 0.05) {
      throw new BadRequestException(`El monto del pago ($${montoVal}) supera el saldo pendiente de la factura ($${saldoRestante}).`);
    }

    const pagoRegistrado = await this.prisma.$transaction(async (tx) => {
      // Crear el registro del Pago
      const pago = await tx.pagoCompra.create({
        data: {
          facturaCompraId,
          monto: montoVal,
          metodoPago,
          referencia: referencia || null,
          chequeNumero: chequeNumero || null,
          chequeBanco: chequeBanco || null,
          chequeVence: chequeVence ? new Date(chequeVence) : null,
          transfeCuenta: transfeCuenta || null,
          estado: 'PENDIENTE_CONFIRMACION',
          usuarioId: userId,
        },
      });

      // Actualizar el estado de la factura
      const nuevoTotalPagos = pagosAnteriores + montoVal;
      let nuevoEstado = 'PAGADA_PARCIAL';
      if (Math.abs(factura.total - nuevoTotalPagos) <= 0.05) {
        nuevoEstado = 'PAGADA';
      }

      await tx.facturaCompra.update({
        where: { id: facturaCompraId },
        data: { estado: nuevoEstado },
      });

      // Sincronizar pago con public.PagoCompra
      await tx.publicPagoCompra.create({
        data: {
          id: pago.id,
          facturaCompraId: pago.facturaCompraId,
          monto: pago.monto,
          fechaPago: pago.fechaPago,
          metodoPago: pago.metodoPago,
          referencia: pago.referencia,
          usuarioId: pago.usuarioId,
          createdAt: pago.createdAt,
          chequeNumero: pago.chequeNumero,
          chequeBanco: pago.chequeBanco,
          chequeVence: pago.chequeVence,
          transfeCuenta: pago.transfeCuenta,
        },
      });

      // Sincronizar estado de factura con public.FacturaCompra
      await tx.publicFacturaCompra.update({
        where: { id: facturaCompraId },
        data: { estado: nuevoEstado },
      });

      // Generar Póliza de Egresos (Asiento Contable de Pago)
      const configList = await tx.configuracionContable.findMany();
      const configMap: Record<string, string> = {};
      for (const c of configList) {
        configMap[c.clave] = c.valor;
      }

      const cuentaCuentasPorPagar = configMap['cuenta_proveedores'] || '2.1.01.01';
      const cuentaBancos = configMap['cuenta_bancos'] || '1.1.01.02';

      const count = await tx.asientoDiario.count();
      const corr = String(count + 1).padStart(5, '0');
      const anio = new Date().getFullYear();
      const numeroAsiento = `ADI-EG-${anio}-${corr}`;

      const asiento = await tx.asientoDiario.create({
        data: {
          numero: numeroAsiento,
          concepto: `Cancelación Factura N° ${factura.numeroFactura} via ${metodoPago} (${referencia || 'S/R'})`,
          fecha: new Date(),
          referencia: pago.id,
          tipoOrigen: 'PAGO',
          estado: 'POSTEADO',
        },
      });

      // Líneas de Partida Doble
      const cCuentasPorPagarDb = await tx.cuentaContable.findUnique({ where: { codigo: cuentaCuentasPorPagar } });
      const cBancosDb = await tx.cuentaContable.findUnique({ where: { codigo: cuentaBancos } });

      // Débito: Cuentas por Pagar (disminuye pasivo)
      if (cCuentasPorPagarDb) {
        await tx.lineaAsiento.create({
          data: {
            asientoId: asiento.id,
            cuentaId: cCuentasPorPagarDb.id,
            debe: montoVal,
            haber: 0.0,
            glosa: `Amortización de deuda Factura N° ${factura.numeroFactura}`,
          },
        });
      }

      // Crédito: Banco / Caja (disminuye activo)
      if (cBancosDb) {
        await tx.lineaAsiento.create({
          data: {
            asientoId: asiento.id,
            cuentaId: cBancosDb.id,
            debe: 0.0,
            haber: montoVal,
            glosa: `Salida de efectivo por pago a proveedor`,
          },
        });
      }

      // Guardar ID de Asiento Contable en Pago
      return tx.pagoCompra.update({
        where: { id: pago.id },
        data: { asientoId: asiento.id },
      });
    });

    // Auditoría
    await this.prisma.auditoria.create({
      data: {
        usuarioId: userId,
        accion: 'REGISTRAR_PAGO_COMPRA',
        modulo: 'CONTABILIDAD',
        detalles: JSON.stringify({
          pagoId: pagoRegistrado.id,
          facturaId: facturaCompraId,
          monto: montoVal,
        }),
      },
    });

    return pagoRegistrado;
  }

  // --- CONCILIACIÓN BANCARIA ---

  async listarConciliaciones() {
    return this.prisma.conciliacionBancaria.findMany({
      orderBy: { fechaEjecucion: 'desc' },
    });
  }

  async crearLineaBanco(body: any) {
    const { referenciaBanco, monto, tipo, observaciones } = body;
    if (!referenciaBanco || monto == null || !tipo) {
      throw new BadRequestException('Campos obligatorios faltantes en la línea de banco.');
    }
    return this.prisma.conciliacionBancaria.create({
      data: {
        referenciaBanco,
        monto: parseFloat(monto),
        tipo,
        estado: 'PENDIENTE',
        observaciones: observaciones || null,
      },
    });
  }

  async conciliarPago(pagoId: string, lineaBancoId: string, userId: string) {
    const pago = await this.prisma.pagoCompra.findUnique({
      where: { id: pagoId },
    });
    const linea = await this.prisma.conciliacionBancaria.findUnique({
      where: { id: lineaBancoId },
    });

    if (!pago || !linea) {
      throw new BadRequestException('Pago o Línea de Banco no encontrados.');
    }

    if (pago.estado === 'CONCILIADO' || linea.estado === 'CONCILIADO') {
      throw new BadRequestException('El pago o la línea de banco ya están conciliados.');
    }

    // Verificar correspondencia de montos (con margen de 0.05)
    if (Math.abs(pago.monto - linea.monto) > 0.05) {
      throw new BadRequestException(`Discrepancia de monto: el pago es de $${pago.monto} y el banco reporta $${linea.monto}.`);
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const p = await tx.pagoCompra.update({
        where: { id: pagoId },
        data: { estado: 'CONCILIADO' },
      });
      const l = await tx.conciliacionBancaria.update({
        where: { id: lineaBancoId },
        data: { estado: 'CONCILIADO' },
      });
      return { pago: p, linea: l };
    });

    // Auditoría
    await this.prisma.auditoria.create({
      data: {
        usuarioId: userId,
        accion: 'CONCILIAR_PAGO_BANCO',
        modulo: 'CONTABILIDAD',
        detalles: JSON.stringify({ pagoId, lineaBancoId }),
      },
    });

    return { success: true, message: 'Pago conciliado exitosamente con la cartola bancaria.', resultado };
  }
}

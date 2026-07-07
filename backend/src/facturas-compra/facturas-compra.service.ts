import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FacturasCompraService {
  constructor(private prisma: PrismaService) {}

  async listarFacturas() {
    return this.prisma.facturaCompra.findMany({
      include: {
        proveedor: true,
        ordenCompra: true,
        recepcionMaterial: true,
        pagos: true,
        notas: true,
        detalles: {
          include: {
            producto: true,
          },
        },
      },
      orderBy: { fechaEmision: 'desc' },
    });
  }

  async obtenerUna(id: string) {
    const fact = await this.prisma.facturaCompra.findUnique({
      where: { id },
      include: {
        proveedor: true,
        ordenCompra: true,
        recepcionMaterial: true,
        pagos: true,
        notas: true,
        detalles: {
          include: {
            producto: true,
          },
        },
      },
    });
    if (!fact) {
      throw new BadRequestException('La factura no existe.');
    }
    return fact;
  }

  async crearFactura(body: any, userId: string) {
    const {
      numeroFactura,
      proveedorId,
      ordenCompraId,
      recepcionMaterialId,
      fechaEmision,
      subtotal: rawSubtotal,
      iva: rawIva,
      total: rawTotal,
      observaciones,
      detalles,
      retenerRenta, // boolean check for 10% professional services retention
    } = body;

    if (
      !numeroFactura ||
      !proveedorId ||
      !fechaEmision ||
      rawTotal == null ||
      !detalles ||
      detalles.length === 0
    ) {
      throw new BadRequestException(
        'Los campos número de factura, proveedor, fecha de emisión, total y detalles son obligatorios.',
      );
    }

    // 1. Obtener proveedor y término de pago
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id: proveedorId },
      include: { terminoPago: true },
    });
    if (!proveedor) {
      throw new BadRequestException('El proveedor especificado no existe.');
    }

    // 2. Calcular vencimiento
    const emision = new Date(fechaEmision);
    const diasCredito = proveedor.terminoPago?.dias || 0;
    const vencimiento = new Date(emision.getTime() + diasCredito * 24 * 60 * 60 * 1000);

    const subtotalVal = parseFloat(rawSubtotal || rawTotal);
    const ivaVal = parseFloat(rawIva || 0);

    // 3. Lógica Tributaria de El Salvador (Retenciones)
    // Retención 1% de IVA (Gran Contribuyente a Mediano/Pequeño en compras > $100.00 netos)
    let retencionIva = 0.0;
    if (
      proveedor.tipoContribuyente !== 'GRAN_CONTRIBUYENTE' &&
      subtotalVal >= 100.00
    ) {
      retencionIva = Math.round(subtotalVal * 0.01 * 100) / 100;
    }

    // Retención 10% ISR (Servicios Profesionales de Persona Natural)
    let retencionRenta = 0.0;
    if (retenerRenta) {
      retencionRenta = Math.round(subtotalVal * 0.10 * 100) / 100;
    }

    // Total líquido a pagar al proveedor
    const totalLiquid = Math.round((subtotalVal + ivaVal - retencionIva - retencionRenta) * 100) / 100;

    // 4. Lógica de Three-Way Match (Comparación PO vs GRN vs Factura)
    let matchStatus = 'NO_APLICA';
    let estado = 'PENDIENTE';

    if (ordenCompraId || recepcionMaterialId) {
      matchStatus = 'MATCH_OK'; // default to OK, check for mismatch

      // Cargar detalles de la Orden de Compra para precios acordados
      let poDetallesMap: Record<string, number> = {};
      if (ordenCompraId) {
        const po = await this.prisma.ordenCompra.findUnique({
          where: { id: ordenCompraId },
          include: { detalles: true },
        });
        if (po) {
          po.detalles.forEach((d) => {
            poDetallesMap[d.productoId] = d.costoUnitario;
          });
        }
      }

      // Cargar detalles de la Recepción física para cantidades recibidas
      let grnDetallesMap: Record<string, number> = {};
      if (recepcionMaterialId) {
        const grn = await this.prisma.recepcionMaterial.findUnique({
          where: { id: recepcionMaterialId },
          include: { detalles: true },
        });
        if (grn) {
          grn.detalles.forEach((d) => {
            grnDetallesMap[d.productoId] = (grnDetallesMap[d.productoId] || 0) + d.cantidad;
          });
        }
      }

      // Verificar cada línea facturada
      for (const d of detalles) {
        const factQty = parseFloat(d.cantidad);
        const factPrice = parseFloat(d.costoUnitario);

        // A. Comparar precio unitario con la Orden de Compra (PO)
        if (ordenCompraId && poDetallesMap[d.productoId] !== undefined) {
          const poPrice = poDetallesMap[d.productoId];
          if (Math.abs(factPrice - poPrice) > 0.01) {
            matchStatus = 'MATCH_MISMATCH'; // El precio no coincide con el pactado
          }
        }

        // B. Comparar cantidad facturada con la cantidad física recibida (GRN)
        if (recepcionMaterialId && grnDetallesMap[d.productoId] !== undefined) {
          const grnQty = grnDetallesMap[d.productoId];
          if (factQty > grnQty + 0.01) {
            matchStatus = 'MATCH_MISMATCH'; // Cantidad facturada excede la recibida físicamente
          }
        }
      }

      if (matchStatus === 'MATCH_MISMATCH') {
        estado = 'BLOQUEADA_MATCH'; // Bloquear factura para pago hasta resolución manual
      }
    }

    // 5. Transacción de Creación y Asiento Contable Automático
    const facturaCreada = await this.prisma.$transaction(async (tx) => {
      // Validar unicidad
      const exist = await tx.facturaCompra.findUnique({
        where: {
          proveedorId_numeroFactura: {
            proveedorId,
            numeroFactura,
          },
        },
      });
      if (exist) {
        throw new BadRequestException('Ya existe una factura registrada con ese número para este proveedor.');
      }

      // Crear la factura
      const fact = await tx.facturaCompra.create({
        data: {
          numeroFactura,
          proveedorId,
          ordenCompraId: ordenCompraId || null,
          recepcionMaterialId: recepcionMaterialId || null,
          fechaEmision: emision,
          fechaVencimiento: vencimiento,
          subtotal: subtotalVal,
          iva: ivaVal,
          retencionIva,
          retencionRenta,
          total: totalLiquid,
          estado,
          matchStatus,
          observaciones: observaciones || null,
          moneda: proveedor.moneda || 'USD',
          detalles: {
            create: detalles.map((d: any) => ({
              productoId: d.productoId,
              cantidad: parseFloat(d.cantidad),
              costoUnitario: parseFloat(d.costoUnitario),
              subtotal: parseFloat(d.cantidad) * parseFloat(d.costoUnitario),
            })),
          },
        },
      });

      // Si la factura está PENDIENTE (no bloqueada), generar asiento contable de forma automática
      let factFinal = fact;
      if (estado === 'PENDIENTE') {
        const configMap = await this.obtenerConfiguracionContableMap(tx);
        const asiento = await this.crearAsientoContableDeFactura(tx, fact, detalles, configMap);

        // Actualizar factura con ID de asiento
        factFinal = await tx.facturaCompra.update({
          where: { id: fact.id },
          data: {
            asientoId: asiento.id,
            estado: 'APROBADA', // Pasa a aprobada para pago
          },
        });
      }

      // Sincronizar con el esquema public
      await tx.publicFacturaCompra.create({
        data: {
          id: factFinal.id,
          numeroFactura: factFinal.numeroFactura,
          proveedorId: factFinal.proveedorId,
          ordenCompraId: factFinal.ordenCompraId,
          recepcionMaterialId: factFinal.recepcionMaterialId,
          fechaEmision: factFinal.fechaEmision,
          fechaVencimiento: factFinal.fechaVencimiento,
          subtotal: factFinal.subtotal,
          iva: factFinal.iva,
          total: factFinal.total,
          estado: factFinal.estado,
          observaciones: factFinal.observaciones,
          detalles: {
            create: detalles.map((d: any) => ({
              productoId: d.productoId,
              cantidad: parseFloat(d.cantidad),
              costoUnitario: parseFloat(d.costoUnitario),
              subtotal: parseFloat(d.cantidad) * parseFloat(d.costoUnitario),
            })),
          },
        },
      });

      return factFinal;
    });

    // Auditoría
    await this.prisma.auditoria.create({
      data: {
        usuarioId: userId,
        accion: 'REGISTRAR_FACTURA_COMPRA_CONTABLE',
        modulo: 'CONTABILIDAD',
        detalles: JSON.stringify({
          facturaId: facturaCreada.id,
          numero: numeroFactura,
          matchStatus,
          retencionIva,
          retencionRenta,
          total: totalLiquid,
        }),
      },
    });

    return facturaCreada;
  }

  async autorizarMatchManual(id: string, userId: string) {
    const fact = await this.prisma.facturaCompra.findUnique({
      where: { id },
      include: { detalles: true, proveedor: true },
    });
    if (!fact) {
      throw new BadRequestException('La factura no existe.');
    }
    if (fact.estado !== 'BLOQUEADA_MATCH') {
      throw new BadRequestException('La factura no está bloqueada por match.');
    }

    const configMap = await this.obtenerConfiguracionContableMap(this.prisma);

    const facturaActualizada = await this.prisma.$transaction(async (tx) => {
      // Generar Asiento Contable
      const asiento = await this.crearAsientoContableDeFactura(tx, fact, fact.detalles, configMap);

      const f = await tx.facturaCompra.update({
        where: { id },
        data: {
          estado: 'APROBADA',
          matchStatus: 'MATCH_OK', // Sobrescribir
          asientoId: asiento.id,
        },
      });

      // Sincronizar con public.FacturaCompra
      await tx.publicFacturaCompra.update({
        where: { id },
        data: {
          estado: 'APROBADA',
        },
      });

      return f;
    });

    // Auditoría
    await this.prisma.auditoria.create({
      data: {
        usuarioId: userId,
        accion: 'OVERRIDE_THREE_WAY_MATCH',
        modulo: 'CONTABILIDAD',
        detalles: JSON.stringify({ facturaId: id, numero: fact.numeroFactura }),
      },
    });

    return facturaActualizada;
  }

  // --- MÉTODOS DE APOYO INTERNO ---

  private async obtenerConfiguracionContableMap(tx: any) {
    const list = await tx.configuracionContable.findMany();
    const map: Record<string, string> = {};
    for (const c of list) {
      map[c.clave] = c.valor;
    }
    return map;
  }

  private async crearAsientoContableDeFactura(tx: any, fact: any, detalles: any[], configMap: Record<string, string>) {
    // 1. Generar número de asiento único
    const count = await tx.asientoDiario.count();
    const corr = String(count + 1).padStart(5, '0');
    const anio = new Date(fact.fechaEmision).getFullYear();
    const numeroAsiento = `ADI-FC-${anio}-${corr}`;

    // 2. Determinar cuentas contables
    const cuentaCuentasPorPagar = configMap['cuenta_proveedores'] || '2.1.01.01';
    const cuentaIvaCredito = configMap['cuenta_iva_credito'] || '1.1.04.01';
    const cuentaIvaRetenido = configMap['cuenta_iva_retenido'] || '2.1.02.01';
    const cuentaRentaRetenida = configMap['cuenta_renta_retenida'] || '2.1.02.02';

    // Determinar la cuenta del activo/gasto.
    // Dependiendo del tipo de producto podemos mapear a materias primas, insumos o gastos administrativos
    const cuentaMateriaPrima = configMap['cuenta_inventario_mp'] || '1.1.03.01';
    const cuentaInsumos = configMap['cuenta_inventario_insumos'] || '1.1.03.02';
    const cuentaGastosGenerales = configMap['cuenta_gastos'] || '6.1.01.03';

    // Crear cabecera de Asiento
    const asiento = await tx.asientoDiario.create({
      data: {
        numero: numeroAsiento,
        concepto: `Registro de Factura de Compra N° ${fact.numeroFactura}`,
        fecha: fact.fechaEmision,
        referencia: fact.id,
        tipoOrigen: 'FACTURA',
        estado: 'POSTEADO',
      },
    });

    // 3. Crear líneas de partida doble
    const lineas: any[] = [];

    // LÍNEA 1: Débito al Inventario / Gasto
    // Agrupamos el subtotal según el tipo de producto
    let cuentaInventarioGasto = cuentaMateriaPrima; // default
    if (detalles && detalles.length > 0) {
      // Buscar el primer producto en la factura para decidir la cuenta contable
      const primerDet = detalles[0];
      const prod = await tx.producto.findUnique({ where: { id: primerDet.productoId } });
      if (prod) {
        if (prod.tipoProducto === 'MATERIA_PRIMA' || prod.tipoProducto === 'MP') {
          cuentaInventarioGasto = cuentaMateriaPrima;
        } else if (prod.tipoProducto === 'MNA' || prod.tipoProducto === 'MATERIAL_NO_ALIMENTARIO') {
          cuentaInventarioGasto = cuentaInsumos;
        } else if (prod.tipoProducto === 'PRODUCTO_TERMINADO' || prod.tipoProducto === 'PT') {
          const cuentaPt = configMap['cuenta_inventario_pt'] || '1.1.03.03';
          cuentaInventarioGasto = cuentaPt;
        } else {
          cuentaInventarioGasto = cuentaGastosGenerales;
        }
      }
    }

    // Débito Subtotal
    const cInventarioGastoDb = await tx.cuentaContable.findUnique({ where: { codigo: cuentaInventarioGasto } });
    if (cInventarioGastoDb) {
      lineas.push({
        asientoId: asiento.id,
        cuentaId: cInventarioGastoDb.id,
        debe: fact.subtotal,
        haber: 0.0,
        glosa: `Subtotal Factura N° ${fact.numeroFactura}`,
      });
    }

    // Débito IVA (si hay IVA)
    if (fact.iva > 0) {
      const cIvaDb = await tx.cuentaContable.findUnique({ where: { codigo: cuentaIvaCredito } });
      if (cIvaDb) {
        lineas.push({
          asientoId: asiento.id,
          cuentaId: cIvaDb.id,
          debe: fact.iva,
          haber: 0.0,
          glosa: `13% IVA Crédito Fiscal`,
        });
      }
    }

    // Crédito Cuentas por Pagar Proveedor
    const cCuentasPorPagarDb = await tx.cuentaContable.findUnique({ where: { codigo: cuentaCuentasPorPagar } });
    if (cCuentasPorPagarDb) {
      lineas.push({
        asientoId: asiento.id,
        cuentaId: cCuentasPorPagarDb.id,
        debe: 0.0,
        haber: fact.total, // El total líquido neto de retenciones
        glosa: `Obligación por pagar al proveedor`,
      });
    }

    // Crédito Retención IVA 1% (si aplica)
    if (fact.retencionIva > 0) {
      const cIvaRetDb = await tx.cuentaContable.findUnique({ where: { codigo: cuentaIvaRetenido } });
      if (cIvaRetDb) {
        lineas.push({
          asientoId: asiento.id,
          cuentaId: cIvaRetDb.id,
          debe: 0.0,
          haber: fact.retencionIva,
          glosa: `1% Retención IVA Gran Contribuyente`,
        });
      }
    }

    // Crédito Retención Renta 10% (si aplica)
    if (fact.retencionRenta > 0) {
      const cRentaRetDb = await tx.cuentaContable.findUnique({ where: { codigo: cuentaRentaRetenida } });
      if (cRentaRetDb) {
        lineas.push({
          asientoId: asiento.id,
          cuentaId: cRentaRetDb.id,
          debe: 0.0,
          haber: fact.retencionRenta,
          glosa: `10% Retención de Impuesto sobre la Renta (Servicios)`,
        });
      }
    }

    // Crear todas las líneas del asiento contable en la base de datos
    for (const line of lineas) {
      await tx.lineaAsiento.create({ data: line });
    }

    return asiento;
  }
}

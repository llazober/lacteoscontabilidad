import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CuentasService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Auto-seed accounts and config on start if empty
    await this.seedCatalogoYConfiguraciones();
  }

  async seedCatalogoYConfiguraciones() {
    const count = await this.prisma.cuentaContable.count();
    if (count === 0) {
      console.log('Sembrando catálogo de cuentas de El Salvador...');
      const catalogo = [
        // Nivel 1
        { codigo: '1', nombre: 'Activo', tipo: 'ACTIVO', nivel: 1 },
        { codigo: '2', nombre: 'Pasivo', tipo: 'PASIVO', nivel: 1 },
        { codigo: '3', nombre: 'Patrimonio', tipo: 'PATRIMONIO', nivel: 1 },
        { codigo: '4', nombre: 'Ingresos', tipo: 'INGRESO', nivel: 1 },
        { codigo: '5', nombre: 'Costos', tipo: 'COSTO', nivel: 1 },
        { codigo: '6', nombre: 'Gastos', tipo: 'GASTO', nivel: 1 },

        // Nivel 2
        { codigo: '1.1', nombre: 'Activo Corriente', tipo: 'ACTIVO', nivel: 2 },
        { codigo: '1.2', nombre: 'Activo No Corriente', tipo: 'ACTIVO', nivel: 2 },
        { codigo: '2.1', nombre: 'Pasivo Corriente', tipo: 'PASIVO', nivel: 2 },
        { codigo: '3.1', nombre: 'Capital Contable', tipo: 'PATRIMONIO', nivel: 2 },
        { codigo: '4.1', nombre: 'Ingresos de Operación', tipo: 'INGRESO', nivel: 2 },
        { codigo: '5.1', nombre: 'Costos de Venta y Compra', tipo: 'COSTO', nivel: 2 },
        { codigo: '6.1', nombre: 'Gastos de Operación', tipo: 'GASTO', nivel: 2 },

        // Nivel 3
        { codigo: '1.1.01', nombre: 'Efectivo y Equivalentes', tipo: 'ACTIVO', nivel: 3 },
        { codigo: '1.1.02', nombre: 'Cuentas y Documentos por Cobrar', tipo: 'ACTIVO', nivel: 3 },
        { codigo: '1.1.03', nombre: 'Inventarios', tipo: 'ACTIVO', nivel: 3 },
        { codigo: '1.1.04', nombre: 'Impuestos por Recuperar (Crédito Fiscal)', tipo: 'ACTIVO', nivel: 3 },
        { codigo: '2.1.01', nombre: 'Cuentas y Documentos por Pagar', tipo: 'PASIVO', nivel: 3 },
        { codigo: '2.1.02', nombre: 'Impuestos y Retenciones por Pagar', tipo: 'PASIVO', nivel: 3 },
        { codigo: '4.1.01', nombre: 'Ventas de Productos', tipo: 'INGRESO', nivel: 3 },
        { codigo: '5.1.01', nombre: 'Costo de Ventas', tipo: 'COSTO', nivel: 3 },
        { codigo: '6.1.01', nombre: 'Gastos Administrativos y de Venta', tipo: 'GASTO', nivel: 3 },

        // Nivel 4 (Detalle / Auxiliares)
        { codigo: '1.1.01.01', nombre: 'Caja Chica', tipo: 'ACTIVO', nivel: 4 },
        { codigo: '1.1.01.02', nombre: 'Banco Agrícola (Cuenta Corriente)', tipo: 'ACTIVO', nivel: 4 },
        { codigo: '1.1.02.01', nombre: 'Clientes Locales', tipo: 'ACTIVO', nivel: 4 },
        { codigo: '1.1.03.01', nombre: 'Inventario de Materia Prima (Leche/Insumos)', tipo: 'ACTIVO', nivel: 4 },
        { codigo: '1.1.03.02', nombre: 'Inventario de Materiales de Empaque', tipo: 'ACTIVO', nivel: 4 },
        { codigo: '1.1.03.03', nombre: 'Inventario de Producto Terminado', tipo: 'ACTIVO', nivel: 4 },
        { codigo: '1.1.04.01', nombre: 'Crédito Fiscal IVA (13%)', tipo: 'ACTIVO', nivel: 4 },
        
        { codigo: '2.1.01.01', nombre: 'Proveedores Locales Cuentas por Pagar', tipo: 'PASIVO', nivel: 4 },
        { codigo: '2.1.02.01', nombre: 'Retención de IVA 1% por Pagar', tipo: 'PASIVO', nivel: 4 },
        { codigo: '2.1.02.02', nombre: 'Retención ISR 10% por Pagar (Servicios)', tipo: 'PASIVO', nivel: 4 },
        { codigo: '2.1.02.03', nombre: 'Débito Fiscal IVA (13%)', tipo: 'PASIVO', nivel: 4 },

        { codigo: '3.1.01.01', nombre: 'Capital Social Mínimo', tipo: 'PATRIMONIO', nivel: 4 },
        { codigo: '3.1.02.01', nombre: 'Utilidades Retenidas de Ejercicios Anteriores', tipo: 'PATRIMONIO', nivel: 4 },

        { codigo: '4.1.01.01', nombre: 'Ventas de Lácteos Locales Gravadas', tipo: 'INGRESO', nivel: 4 },
        { codigo: '5.1.01.01', nombre: 'Compras de Leche Fluida', tipo: 'COSTO', nivel: 4 },
        
        { codigo: '6.1.01.01', nombre: 'Gastos de Planilla y Sueldos', tipo: 'GASTO', nivel: 4 },
        { codigo: '6.1.01.02', nombre: 'Gastos de Energía y Electricidad', tipo: 'GASTO', nivel: 4 },
        { codigo: '6.1.01.03', nombre: 'Gastos Administrativos Generales', tipo: 'GASTO', nivel: 4 },
      ];

      for (const item of catalogo) {
        await this.prisma.cuentaContable.create({ data: item });
      }
      console.log('Catálogo de cuentas sembrado correctamente.');
    }

    // Sembrar configuraciones contables por defecto
    const configCount = await this.prisma.configuracionContable.count();
    if (configCount === 0) {
      console.log('Sembrando configuraciones contables por defecto...');
      const configs = [
        { clave: 'cuenta_proveedores', valor: '2.1.01.01' },
        { clave: 'cuenta_iva_credito', valor: '1.1.04.01' },
        { clave: 'cuenta_iva_retenido', valor: '2.1.02.01' },
        { clave: 'cuenta_renta_retenida', valor: '2.1.02.02' },
        { clave: 'cuenta_bancos', valor: '1.1.01.02' },
        { clave: 'cuenta_inventario_mp', valor: '1.1.03.01' },
        { clave: 'cuenta_inventario_insumos', valor: '1.1.03.02' },
        { clave: 'cuenta_inventario_pt', valor: '1.1.03.03' },
        { clave: 'cuenta_gastos', valor: '6.1.01.03' },
      ];

      for (const config of configs) {
        await this.prisma.configuracionContable.create({ data: config });
      }
      console.log('Configuraciones contables sembradas.');
    }
  }

  async obtenerCuentas() {
    return this.prisma.cuentaContable.findMany({
      orderBy: { codigo: 'asc' },
    });
  }

  async obtenerConfiguraciones() {
    const list = await this.prisma.configuracionContable.findMany();
    const configMap: Record<string, string> = {};
    for (const c of list) {
      configMap[c.clave] = c.valor;
    }
    return configMap;
  }

  async guardarConfiguraciones(body: Record<string, string>) {
    for (const clave of Object.keys(body)) {
      await this.prisma.configuracionContable.upsert({
        where: { clave },
        update: { valor: body[clave] },
        create: { clave, valor: body[clave] },
      });
    }
    return { success: true, message: 'Configuración contable guardada con éxito.' };
  }

  async obtenerAsientos() {
    return this.prisma.asientoDiario.findMany({
      include: {
        lineas: {
          include: {
            cuenta: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async crearCuenta(data: { codigo: string; nombre: string; tipo: string; nivel: number }) {
    const existente = await this.prisma.cuentaContable.findUnique({
      where: { codigo: data.codigo },
    });
    if (existente) {
      throw new Error('El código de cuenta ya existe en el catálogo.');
    }
    return this.prisma.cuentaContable.create({
      data: {
        codigo: data.codigo,
        nombre: data.nombre,
        tipo: data.tipo,
        nivel: Number(data.nivel),
        estado: 'ACTIVO',
      },
    });
  }

  async editarCuenta(id: string, data: { nombre: string; tipo: string; estado: string }) {
    return this.prisma.cuentaContable.update({
      where: { id },
      data: {
        nombre: data.nombre,
        tipo: data.tipo,
        estado: data.estado,
      },
    });
  }

  async eliminarCuenta(id: string) {
    const usaba = await this.prisma.lineaAsiento.findFirst({
      where: { cuentaId: id },
    });
    if (usaba) {
      throw new Error('No se puede eliminar esta cuenta contable porque ya tiene partidas o transacciones registradas.');
    }
    return this.prisma.cuentaContable.delete({
      where: { id },
    });
  }

  async limpiarDatosPrueba() {
    console.log('[BACKEND DEBUG] Iniciando transacción de limpieza en CuentasService...');
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Delete transactions in order
        await tx.lineaAsiento.deleteMany({});
        await tx.asientoDiario.deleteMany({});
        await tx.notaCreditoDebito.deleteMany({});
        await tx.pagoCompra.deleteMany({});

        // Delete public schema payments and invoices
        await tx.publicPagoCompra.deleteMany({});
        await tx.publicFacturaCompraDetalle.deleteMany({});
        await tx.publicFacturaCompra.deleteMany({});

        await tx.facturaCompraDetalle.deleteMany({});
        await tx.facturaCompra.deleteMany({});
        await tx.conciliacionBancaria.deleteMany({});
        
        // 2. Delete custom Chart of Accounts and Configs
        await tx.cuentaContable.deleteMany({});
        await tx.configuracionContable.deleteMany({});
      });

      // 3. Re-seed default Chart of Accounts and default configurations
      await this.seedCatalogoYConfiguraciones();

      return { success: true, message: 'Datos de prueba eliminados correctamente y catálogo restablecido.' };
    } catch (error: any) {
      console.error('Error al limpiar datos de prueba:', error);
      throw new Error('No se pudieron eliminar los datos: ' + error.message);
    }
  }
}

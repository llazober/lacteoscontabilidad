import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CuentasModule } from './cuentas/cuentas.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { FacturasCompraModule } from './facturas-compra/facturas-compra.module';
import { NotasCreditoDebitoModule } from './notas-credito-debito/notas-credito-debito.module';
import { PagosModule } from './pagos/pagos.module';
import { ReportesModule } from './reportes/reportes.module';

@Module({
  imports: [
    PrismaModule,
    CuentasModule,
    ProveedoresModule,
    FacturasCompraModule,
    NotasCreditoDebitoModule,
    PagosModule,
    ReportesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { FacturasCompraController } from './facturas-compra.controller';
import { FacturasCompraService } from './facturas-compra.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: 'CLAVE_SUPER_SECRETA_LA_VAQUITA',
    }),
  ],
  controllers: [FacturasCompraController],
  providers: [FacturasCompraService],
  exports: [FacturasCompraService],
})
export class FacturasCompraModule {}

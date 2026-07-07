import { Module } from '@nestjs/common';
import { CuentasController } from './cuentas.controller';
import { CuentasService } from './cuentas.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: 'CLAVE_SUPER_SECRETA_LA_VAQUITA',
    }),
  ],
  controllers: [CuentasController],
  providers: [CuentasService],
  exports: [CuentasService],
})
export class CuentasModule {}

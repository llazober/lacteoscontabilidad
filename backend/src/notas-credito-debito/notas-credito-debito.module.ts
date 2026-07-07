import { Module } from '@nestjs/common';
import { NotasCreditoDebitoController } from './notas-credito-debito.controller';
import { NotasCreditoDebitoService } from './notas-credito-debito.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: 'CLAVE_SUPER_SECRETA_LA_VAQUITA',
    }),
  ],
  controllers: [NotasCreditoDebitoController],
  providers: [NotasCreditoDebitoService],
  exports: [NotasCreditoDebitoService],
})
export class NotasCreditoDebitoModule {}

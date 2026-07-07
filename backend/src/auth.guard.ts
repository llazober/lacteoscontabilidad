import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Token de autenticación faltante o inválido.',
      );
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: 'CLAVE_SUPER_SECRETA_LA_VAQUITA',
      });
      request.user = payload;

      // Restringir módulo de contabilidad financiera a ADMINISTRADOR o SUPERVISOR
      const isAuthorized =
        payload.rol === 'ADMINISTRADOR' || payload.rol === 'SUPERVISOR';

      if (!isAuthorized) {
        throw new ForbiddenException(
          'No tiene permisos suficientes para acceder al módulo de Contabilidad.',
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }
}

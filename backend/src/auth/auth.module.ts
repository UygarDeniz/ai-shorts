import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), PrismaModule],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}

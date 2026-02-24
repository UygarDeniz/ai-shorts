import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'node:path';
import { validate } from './env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { VideoModule } from './video/video.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EnvironmentVariables } from './env.validation.js';

const stage = process.env.APP_STAGE || 'dev';
const envFile = stage === 'dev' ? '.env' : `.env.${stage}`;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: envFile,
      validate,
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables>) => ({
        connection: {
          host: configService.get('REDIS_HOST', { infer: true }),
          port: configService.get('REDIS_PORT', { infer: true }),
        },
      }),
    }),

    ServeStaticModule.forRoot({
      rootPath: path.resolve(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
      },
    }),

    PrismaModule,
    AuthModule,
    VideoModule,
  ],
})
export class AppModule {}

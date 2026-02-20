import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const frontendUrl =
    configService.get<string>('frontendUrl') ?? 'http://localhost:3000';
  const port = configService.get<number>('port') ?? 3001;

  app.enableCors({
    origin: frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);
  logger.log(`Backend running on http://localhost:${port}`);
}

void bootstrap();

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('OmniClaimAPI');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  app.useBodyParser('json', { limit: '15mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '15mb' });

  // Global exception filter for RFC 7807 Problem Details
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // Strict DTO validation & transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger OpenAPI 3.0 Documentation
  const config = new DocumentBuilder()
    .setTitle('OmniClaim Core API')
    .setDescription(
      'Automated Multi-Modal Auto Insurance Claim & Fraud Detection Engine API Gateway',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 OmniClaim Backend Core Gateway running on: http://localhost:${port}`);
  logger.log(`📚 OpenAPI Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();

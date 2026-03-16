import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ CORS antes de listen
  app.enableCors({ origin: 'http://localhost:4000' });

  const config = new DocumentBuilder()
    .setTitle('Sistema Integrado Vilaseca S.A.')
    .setDescription('API del Sistema Integrado Vilaseca S.A.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
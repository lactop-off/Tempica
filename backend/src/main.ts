import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import connectPgSimple from 'connect-pg-simple';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import helmet from 'helmet';
import passport from 'passport';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());

  const corsOrigin = config.get('CORS_ORIGIN', 'http://localhost:8080');
  app.enableCors({ origin: corsOrigin.split(','), credentials: true });

  // PostgreSQL をセッションストアに使用（Redis 不要）
  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({
        conString: config.getOrThrow('DATABASE_URL'),
        tableName: 'user_sessions',
        createTableIfMissing: true,
      }),
      secret: config.getOrThrow('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8, // 8時間
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tempica API')
    .setDescription('汎用勤怠管理システム バックエンド API (MVP)')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(config.get('PORT', 3000));
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Tempica backend listening on :${port} (prefix /api/v1)`);
}

bootstrap();

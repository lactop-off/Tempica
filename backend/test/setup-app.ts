import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import connectPgSimple from 'connect-pg-simple';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

/** main.ts と同等のミドルウェア構成で e2e 用 Nest アプリを生成する。 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());

  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({
        conString: config.getOrThrow('DATABASE_URL'),
        tableName: 'user_sessions',
        createTableIfMissing: true,
      }),
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: false, sameSite: 'lax' },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return app;
}

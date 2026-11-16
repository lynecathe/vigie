import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createAppModule } from "./app.module";
import { loadEnv } from "./config/env";

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(createAppModule(env));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.corsOrigins, credentials: true });
  app.setGlobalPrefix("api");
  // Rejette tout champ non prévu dans les DTO (protection contre le mass assignment).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(env.port);
  console.log(`API Vigie démarrée sur http://localhost:${env.port}/api`);
}

bootstrap();

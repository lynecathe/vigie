import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { createAppModule } from "../src/app.module";
import { loadEnv } from "../src/config/env";

/** Démarre l'API comme en production (préfixe, validation stricte). */
export async function startApp(): Promise<{ app: INestApplication; http: ReturnType<typeof request> }> {
  const moduleRef = await Test.createTestingModule({ imports: [createAppModule(loadEnv())] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return { app, http: request(app.getHttpServer()) };
}

export const ADMIN = { email: process.env.SEED_ADMIN_EMAIL!, password: process.env.SEED_ADMIN_PASSWORD! };

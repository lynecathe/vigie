import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { hashPassword } from "../auth/password";
import { DB, Database } from "../db/db.module";
import { users } from "../db/schema";
import { CreateUserDto } from "./dto/create-user.dto";

const publicFields = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  role: users.role,
  createdAt: users.createdAt,
  disabledAt: users.disabledAt,
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.db.select(publicFields).from(users).orderBy(asc(users.createdAt));
  }

  async create(dto: CreateUserDto, actorId: string, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing.length > 0) throw new ConflictException("Un utilisateur avec cet e-mail existe déjà");

    const [created] = await this.db
      .insert(users)
      .values({ email, fullName: dto.fullName, role: dto.role, passwordHash: await hashPassword(dto.password) })
      .returning(publicFields);

    await this.audit.log({ action: "USER_CREATED", actorId, target: created.id, ip, metadata: { role: dto.role } });
    return created;
  }
}

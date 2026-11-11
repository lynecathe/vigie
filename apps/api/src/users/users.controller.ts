import { Body, Controller, Get, Ip, Post } from "@nestjs/common";
import { AuthUser, CurrentUser, Roles } from "../auth/decorators";
import { CreateUserDto } from "./dto/create-user.dto";
import { UsersService } from "./users.service";

/** Gestion des comptes : réservée aux administrateurs. */
@Roles("ADMIN")
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @Ip() ip: string) {
    return this.users.create(dto, actor.id, ip);
  }
}

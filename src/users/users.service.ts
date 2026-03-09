import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private hidePassword(user: any) {
    const { password, ...rest } = user;
    return rest;
  }

  async create(createUserDto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (exists) throw new ConflictException('Email already exists');

    const saltRounds = Number(process.env.SALT_ROUNDS || 12);
    const hashed = await bcrypt.hash(createUserDto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        nombre: createUserDto.nombre,
        email: createUserDto.email,
        password: hashed,
      },
    });
    return this.hidePassword(user);
  }

  async findAll(page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          nombre: true,
          email: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return { total, data, page, limit };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    return this.hidePassword(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null, active: true },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto, updatedBy?: number) {
    await this.findOne(id);
    const data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      const saltRounds = Number(process.env.SALT_ROUNDS || 12);
      data.password = await bcrypt.hash(updateUserDto.password, saltRounds);
    }
    if (updatedBy) data.updatedBy = updatedBy;
    const user = await this.prisma.user.update({ where: { id }, data });
    return this.hidePassword(user);
  }

  async remove(id: number, updatedBy?: number) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), active: false, updatedBy: updatedBy ?? null },
    });
    return this.hidePassword(user);
  }
}
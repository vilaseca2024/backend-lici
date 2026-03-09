import { Controller, Post, Body, UsePipes, ValidationPipe, Req, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    const user = await this.authService.validateUserCredentials(loginDto.email, loginDto.password);
    if (!user) throw new Error('Credenciales inválidas'); // el controller puede lanzar UnauthorizedException si prefieres
    const ip = req.ip;
    const ua = req.headers['user-agent'] || null;
    return this.authService.login(user, ip, ua);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: any) {
    const authHeader = req.headers['authorization'] || '';
    const token = (authHeader as string).replace(/^Bearer\s+/i, '');
    return this.authService.logout(token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return { user: req.user };
  }
}
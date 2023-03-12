import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthenticationService } from './authentication.service';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';

@ApiTags('auth')
@Controller()
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post('/register')
  register(@Body() registerUserDto: RegisterUserDto) {
    return this.authenticationService.register(registerUserDto);
  }

  @Post('/login')
  login(@Body() loginDto: LoginDto) {
    return this.authenticationService.login(loginDto);
  }
}

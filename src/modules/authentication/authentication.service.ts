import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginDto } from './dto/login.dto';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerUserDto: RegisterUserDto) {
    const salt = await bcrypt.genSalt();
    const hashPwd = await bcrypt.hash(registerUserDto.password, salt);
    return this.userService.create({
      email: registerUserDto.email,
      name: registerUserDto.name,
      password: hashPwd,
    });
  }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userService.findByEmail(username);
    if (user && (await bcrypt.compare(user.password, pass))) {
      user.password = undefined;
      return user;
    }
    return null;
  }

  async login(user: any) {
    return {
      access_token: this.jwtService.sign({
        username: user.username,
        sub: user.userId,
      }),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: number;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Passport JWT strategy — validates the access token from the Authorization header.
 * On success, passport sets req.user to the return value of validate().
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  /**
   * Called after passport verifies the token signature + expiry.
   * Returns the value set as req.user — keep it minimal.
   */
  async validate(payload: JwtPayload) {
    return { id: payload.sub, email: payload.email };
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { type JwtPayload } from '../../types/auth.types';

/**
 * Passport JWT strategy — validates the access token from the Authorization header.
 * On success, passport sets req.user to the return value of validate().
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  // configService is intentionally NOT stored as a class property —
  // it is only used here to read jwt.secret once at startup.
  constructor(configService: ConfigService) {
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
  validate(payload: JwtPayload): { id: number; email: string } {
    return { id: payload.sub, email: payload.email };
  }
}

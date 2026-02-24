import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';
import { EnvironmentVariables } from '../env.validation.js';

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: 'authenticated',
      algorithms: ['ES256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${configService.get('SUPABASE_URL', { infer: true })}/auth/v1/.well-known/jwks.json`,
      }),
    });
  }

  validate(payload: SupabaseJwtPayload) {
    // Supabase JWTs contain the user's UUID in the `sub` field
    if (!payload.sub) {
      throw new UnauthorizedException();
    }

    // We attach the user object to the request context
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}

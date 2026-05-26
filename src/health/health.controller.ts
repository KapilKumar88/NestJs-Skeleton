import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../guard/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PrismaService } from '../services/database/prisma.service';
import { RedisService } from '../services/redis/redis.service';

@SkipThrottle() // Health checks must not be rate-limited (uptime monitors)
@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ResponseMessage('Health check')
  @ApiOperation({ summary: 'Application health — DB + Redis status' })
  @ApiResponse({ status: 200, description: 'All healthy' })
  @ApiResponse({
    status: 503,
    description: 'One or more dependencies unhealthy',
  })
  check() {
    return this.health.check([
      // Database ping
      () => this.prismaHealth.pingCheck('database', this.prisma),

      // Redis ping
      async () => {
        const alive = await this.redis.ping();
        return {
          redis: {
            status: alive ? ('up' as const) : ('down' as const),
          },
        };
      },
    ]);
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './guard/decorators/public.decorator';
import { ResponseMessage } from './common/decorators/response-message.decorator';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ResponseMessage('API is running')
  @ApiOperation({ summary: 'Root health-check / welcome endpoint' })
  getHello(): string {
    return this.appService.getHello();
  }
}

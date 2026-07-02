import { Controller, Get, Post, Delete, Param, Query } from '@nestjs/common';
import { DlqService } from './dlq.service';
import { ChannelType } from '@common/enums/channel-type.enum';

@Controller('dlq')
export class DlqController {
  constructor(private readonly dlq: DlqService) {}

  @Get()
  list(
    @Query('tenantId') tenantId?: string,
    @Query('channel') channel?: ChannelType,
  ) {
    return this.dlq.list({ tenantId, channel });
  }

  @Post(':id/replay')
  replay(@Param('id') id: string) {
    return this.dlq.replay(id);
  }

  @Delete(':id/discard')
  discard(@Param('id') id: string) {
    return this.dlq.discard(id);
  }
}

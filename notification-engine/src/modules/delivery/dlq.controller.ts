import { Controller, Get, Post, Delete, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DlqService } from './dlq.service';
import { ChannelType } from '@common/enums/channel-type.enum';

const DLQ_ENTRY_EXAMPLE = {
  _id: '665f1b2c9a1e4c0012ab34cd',
  notificationId: '665f1b2c9a1e4c0012ab34ce',
  tenantId: 'acme',
  channel: 'sms',
  error: "Invalid 'To' number: +1555",
  attempts: 5,
  replayed: false,
  createdAt: '2026-07-07T12:00:00.000Z',
};

@ApiTags('dlq')
@Controller('dlq')
export class DlqController {
  constructor(private readonly dlq: DlqService) {}

  @Get()
  @ApiOperation({
    summary: 'List dead-lettered entries (max 200, newest first)',
  })
  @ApiQuery({ name: 'tenantId', required: false, example: 'acme' })
  @ApiQuery({ name: 'channel', required: false, enum: ChannelType })
  @ApiOkResponse({ schema: { example: [DLQ_ENTRY_EXAMPLE] } })
  list(
    @Query('tenantId') tenantId?: string,
    @Query('channel') channel?: ChannelType,
  ) {
    return this.dlq.list({ tenantId, channel });
  }

  @Post(':id/replay')
  @ApiOperation({
    summary: 'Re-enqueue a dead-lettered job onto its channel queue',
  })
  @ApiParam({ name: 'id', example: '665f1b2c9a1e4c0012ab34cd' })
  @ApiOkResponse({
    schema: {
      example: {
        replayed: true,
        id: '665f1b2c9a1e4c0012ab34cd',
        channel: 'sms',
      },
    },
  })
  replay(@Param('id') id: string) {
    return this.dlq.replay(id);
  }

  @Delete(':id/discard')
  @ApiOperation({ summary: 'Discard a dead-lettered entry' })
  @ApiParam({ name: 'id', example: '665f1b2c9a1e4c0012ab34cd' })
  @ApiOkResponse({
    schema: { example: { discarded: true, id: '665f1b2c9a1e4c0012ab34cd' } },
  })
  discard(@Param('id') id: string) {
    return this.dlq.discard(id);
  }
}

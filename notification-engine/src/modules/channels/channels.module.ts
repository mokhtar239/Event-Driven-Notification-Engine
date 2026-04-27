import { BullModule } from '@nestjs/bullmq';
import { ChannelType } from '@common/enums/channel-type.enum';
import { Module } from '@nestjs/common/decorators/modules/module.decorator';
@Module({
  imports: [
    BullModule.registerQueue(
      { name: ChannelType.EMAIL },
      { name: ChannelType.SMS },
      { name: ChannelType.PUSH },
      { name: ChannelType.INAPP },
    ),
  ],
  exports: [BullModule],
})
export class ChannelsModule {}

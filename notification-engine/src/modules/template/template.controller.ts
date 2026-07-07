import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { TemplateRender } from './template.render';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';

@ApiTags('templates')
@Controller('templates')
export class TemplateController {
  constructor(
    private readonly svc: TemplateService,
    private readonly renderer: TemplateRender,
  ) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Render raw template source with variables (not persisted)',
  })
  @ApiOkResponse({
    schema: { example: { rendered: 'Hi Ada, your total is $42.50.' } },
  })
  preview(@Body() dto: PreviewTemplateDto) {
    return { rendered: this.renderer.renderOnce(dto.source, dto.variables) };
  }

  @Post('render')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Render the stored template for a tenant/event/channel',
  })
  @ApiOkResponse({
    schema: {
      example: {
        subject: 'Order #A-1001 confirmed',
        body: 'Hi Ada, your order #A-1001 for $42.50 is confirmed.',
      },
    },
  })
  render(
    @Body()
    dto: {
      tenantId: string;
      eventType: string;
      channel: string;
      variables: Record<string, unknown>;
    },
  ) {
    return this.svc.renderTemplate(
      dto.tenantId,
      dto.eventType,
      dto.channel,
      dto.variables,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a template' })
  create(@Body() dto: CreateTemplateDto) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List templates (optionally filtered)' })
  @ApiQuery({ name: 'tenantId', required: false, example: 'acme' })
  @ApiQuery({ name: 'eventType', required: false, example: 'order.placed' })
  @ApiQuery({ name: 'channel', required: false, example: 'email' })
  list(
    @Query()
    q: {
      tenantId?: string;
      eventType?: string;
      channel?: string;
    },
  ) {
    return this.svc.list(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a template by id' })
  @ApiParam({ name: 'id', example: '665f1b2c9a1e4c0012ab34cd' })
  get(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a template' })
  @ApiParam({ name: 'id', example: '665f1b2c9a1e4c0012ab34cd' })
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a template' })
  @ApiParam({ name: 'id', example: '665f1b2c9a1e4c0012ab34cd' })
  @ApiOkResponse({
    schema: { example: { deleted: true, id: '665f1b2c9a1e4c0012ab34cd' } },
  })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

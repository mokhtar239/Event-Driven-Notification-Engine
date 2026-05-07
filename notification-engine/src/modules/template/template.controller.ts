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
import { TemplateService } from './template.service';
import { TemplateRender } from './template.render';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';

@Controller('templates')
export class TemplateController {
  constructor(
    private readonly svc: TemplateService,
    private readonly renderer: TemplateRender,
  ) {}

  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: PreviewTemplateDto) {
    return { rendered: this.renderer.renderOnce(dto.source, dto.variables) };
  }

  @Post('render')
  @HttpCode(200)
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
  create(@Body() dto: CreateTemplateDto) {
    return this.svc.create(dto);
  }

  @Get()
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
  get(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

import { IsString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PreviewTemplateDto {
  @ApiProperty({
    example: 'Hi {{firstName}}, your total is {{currency total}}.',
    description: 'Raw template source to render (not persisted).',
  })
  @IsString()
  source!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { firstName: 'Ada', total: 42.5 },
    description: 'Variables interpolated into the source.',
  })
  @IsObject()
  variables!: Record<string, unknown>;
}

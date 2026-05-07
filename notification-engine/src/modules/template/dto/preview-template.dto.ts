import { IsString, IsObject } from 'class-validator';

export class PreviewTemplateDto {
  @IsString()
  source!: string;

  @IsObject()
  variables!: Record<string, unknown>;
}

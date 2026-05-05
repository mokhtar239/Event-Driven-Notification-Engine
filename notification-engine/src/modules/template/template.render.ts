import { Injectable, BadRequestException } from '@nestjs/common';
import * as Handlebars from 'handlebars';

@Injectable()
export class TemplateRender {
  private cashedTemplates = new Map<string, Handlebars.TemplateDelegate>();

  constructor() {
    Handlebars.registerHelper('currency', (value: number) => {
      return typeof value === 'number' ? `$${value.toFixed(2)}` : ' ';
    });

    Handlebars.registerHelper('uppercase', (s: string) => {
      return typeof s === 'string' ? s.toUpperCase() : ' ';
    });
  }
  private getTemplateCashed(
    key: string,
    text: string,
  ): Handlebars.TemplateDelegate {
    if (!this.cashedTemplates.has(key)) {
      const templateFunction = Handlebars.compile(text);
      try {
        this.cashedTemplates.set(key, templateFunction);
        return templateFunction;
      } catch (e) {
        throw new BadRequestException('Invalid template syntax');
      }
    }
    return this.cashedTemplates.get(key) as Handlebars.TemplateDelegate;
  }
  renderCashed(
    key: string,
    text: string,
    vars: Record<string, unknown>,
  ): string {
    const templateFunction = this.getTemplateCashed(key, text);
    const output = templateFunction(vars);
    return output;
  }
  private renderOnce(text: string, vars: Record<string, unknown>): string {
    const output = Handlebars.compile(text)(vars);
    return output;
  }
}

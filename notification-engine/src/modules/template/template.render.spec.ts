import { TemplateRender } from './template.render';

describe('TemplateRender', () => {
  let renderer: TemplateRender;

  beforeEach(() => {
    renderer = new TemplateRender();
  });

  it('interpolates a simple variable', () => {
    expect(renderer.renderOnce('Hi {{name}}', { name: 'Alice' })).toBe(
      'Hi Alice',
    );
  });

  it('interpolates nested variables', () => {
    const out = renderer.renderOnce('Hi {{user.firstName}}', {
      user: { firstName: 'Bob' },
    });
    expect(out).toBe('Hi Bob');
  });

  it('applies the currency helper', () => {
    expect(renderer.renderOnce('{{currency total}}', { total: 49.9 })).toBe(
      '$49.90',
    );
  });

  it('applies the uppercase helper', () => {
    expect(renderer.renderOnce('{{uppercase code}}', { code: 'abc' })).toBe(
      'ABC',
    );
  });

  it('renders missing variables as empty (no throw)', () => {
    expect(renderer.renderOnce('Hi {{missing}}!', {})).toBe('Hi !');
  });

  describe('renderCashed', () => {
    it('renders with a cache key and reuses the compiled template', () => {
      const first = renderer.renderCashed('k1', 'Hi {{name}}', {
        name: 'Carol',
      });
      const second = renderer.renderCashed('k1', 'IGNORED', { name: 'Dave' });

      expect(first).toBe('Hi Carol');

      expect(second).toBe('Hi Dave');
    });
  });
});

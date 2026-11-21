import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ObserverEye from '../ObserverEye';

const markup = (props) => renderToStaticMarkup(<ObserverEye state="idle" size={64} {...props} />);

describe('ObserverEye hexagon frame', () => {
  it('draws a single outer hexagon around the eye (no inner ring)', () => {
    const html = markup({ lens: true });
    expect(html.match(/<polygon/g)).toHaveLength(1);
    expect(html).toContain('points="140,30 236,85 236,195 140,250 44,195 44,85"');
    expect(html).not.toContain('140,44 224,92');
  });

  it('keeps the shader canvas, and the lens-less variant has no frame at all', () => {
    expect(markup({ lens: true })).toContain('<canvas');
    const bare = markup({ lens: false });
    expect(bare).toContain('<canvas');
    expect(bare).not.toContain('<polygon');
  });
});

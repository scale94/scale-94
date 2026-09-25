import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { render } from '@testing-library/react';
import { driveFrames } from '../../../gl/__tests__/driveFrames';
import InterceptField from '../InterceptField';
import { FIELD_UNIFORMS } from '../interceptFieldShader';
import { createFieldBuffers, fillStatic, fillScene } from '../interceptFieldUniforms';
import { nodeXY } from '../interceptGeometry';
import { buildTimeline } from '../../../lib/interceptPacket';

function Harness({ packet = null, onLive = () => {} }) {
  const sceneRef = useRef(null);
  if (!sceneRef.current) {
    const b = createFieldBuffers();
    fillStatic(b, nodeXY);
    fillScene(b, { loads: { UK: 1 }, kept: { UK: 0.5 }, traced: new Set([1]) });
    sceneRef.current = b;
  }
  // Stamped at mount with the (faked) performance clock, as the session does.
  const packetRef = useRef(packet ? { timeline: packet.timeline, start: performance.now() } : null);
  return <InterceptField sceneRef={sceneRef} packetRef={packetRef} sceneVersion={0} onLiveChange={onLive} />;
}

const drive = (packet = null, frames = 3) =>
  driveFrames(() => {
    const out = render(<Harness packet={packet} />);
    return { unmount: out.unmount, rerender: out.rerender };
  }, { frames, version: 2 });

describe('InterceptField GL traffic (spec §3, §7, §10)', () => {
  it('harvests exactly the declared uniforms', () => {
    const names = drive().init
      .filter((l) => l.startsWith('getUniformLocation('))
      .map((l) => JSON.parse(`[${l.slice('getUniformLocation('.length, -1)}]`)[1]);
    expect(names).toEqual(FIELD_UNIFORMS);
  });

  it('draws one cleared full-screen pass per frame', () => {
    const { frames } = drive();
    expect(frames.filter((l) => l === 'drawArrays(5, 0, 4)')).toHaveLength(3);
    expect(frames.filter((l) => l === 'clearColor(0, 0, 0, 0)')).toHaveLength(3);
  });

  it('uploads trunk geometry and keeps the packet dark without a send', () => {
    const { frames } = drive();
    expect(frames.some((l) => /^uniform4fv\(".*:u_trunks", \[/.test(l))).toBe(true);
    expect(frames.some((l) => /^uniform4fv\(".*:u_packet", \[0,0,0,0\]\)$/.test(l))).toBe(true);
  });

  it('lights the packet while one is in flight', () => {
    const packet = { timeline: buildTimeline(['UK', 'US'], [], nodeXY) };
    const { frames } = drive(packet);
    const line = frames.find((l) => /^uniform4fv\(".*:u_packet", /.test(l));
    const values = JSON.parse(line.slice(line.indexOf('['), -1));
    expect(values[2]).toBe(1);
  });

  it('reports not-live when WebGL2 is unavailable', () => {
    const onLive = vi.fn();
    render(<Harness onLive={onLive} />);
    expect(onLive).toHaveBeenLastCalledWith(false);
  });

  it('freezes its call log (written on first run; a later diff is a finding)', () => {
    const { init, frames } = drive(null, 2);
    expect({ init, frames }).toMatchSnapshot();
  });
});

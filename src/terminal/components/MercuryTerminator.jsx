// ── MercuryTerminator ────────────────────────────────────────────────────────
// A quicksilver Mercury whose day/night terminator is a GAUGE of compile state
// (spec 2026-07-17). Distinct kernels loaded push the night→twilight frontier;
// distinct kernels run push twilight→full-day. The surface sheen animates on a
// timer (ambient life); the terminator position is meaning, not rotation.
//
// Skeleton mirrors ObserverEye.jsx: full-quad fragment shader, rAF + 40ms watchdog
// (survives suspended-rAF preview panes), DPR sizing, WEBGL_lose_context cleanup,
// reduced-motion snap. Colours echo the eye: cyan/violet twilight, gold/lime day.
import { useEffect, useRef } from 'react';
import { retrogradeCurve, RETROGRADE_MS } from './retrogradeCurve';
import { useShaderCanvas } from '../gl/useShaderCanvas';

const CYAN = [0.32, 0.70, 0.95];
const GOLD = [1.0, 0.78, 0.15];

const VS = 'attribute vec2 a;varying vec2 v;void main(){v=a;gl_Position=vec4(a,0.,1.);}';
const FS = [
  'precision highp float;varying vec2 v;',
  'uniform float u_t,u_tw,u_day,u_bloom,u_retro;uniform vec3 u_flareCol;',
  'float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.5);return fract(p.x*p.y);}',
  'float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
  ' float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));',
  ' return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}',
  'float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(.8,.6,-.6,.8);',
  ' for(int i=0;i<5;i++){s+=a*vn(p);p=m*p*2.0;a*=.5;}return s;}',
  'void main(){',
  ' vec2 uv=v;',
  ' float r=length(uv);',
  ' if(r>1.0){',
  '  float halo=smoothstep(1.28,1.0,r)*(0.04+u_bloom*0.32);',
  '  gl_FragColor=vec4(u_flareCol*halo,halo);return;',
  ' }',
  ' float nz=sqrt(max(0.0,1.0-r*r));',
  ' vec3 n=vec3(uv,nz);',
  ' float lon=n.x*0.96+n.y*0.10;',                 // vertical great-circle, slight tilt
  ' float w=0.12;',
  ' float twMask =smoothstep(-w,w,lon+(2.0*u_tw -1.0));',
  ' float dayMask=smoothstep(-w,w,lon+(2.0*u_day-1.0));',
  ' vec2 sp=n.xy*2.4;',
  ' float sheen =fbm(sp+vec2(u_t*0.05,-u_t*0.04));',
  ' float sheen2=fbm(sp*1.8+vec2(2.0)+u_t*0.03);',
  ' vec3 nightCol=vec3(0.05,0.06,0.10);',
  ' vec3 twCol=mix(vec3(0.22,0.55,0.85),vec3(0.42,0.32,0.78),sheen);',
  ' vec3 dayCol=mix(vec3(1.00,0.84,0.0),vec3(0.48,0.72,0.0),sheen2);',
  ' vec3 col=mix(nightCol,twCol,twMask);',
  ' col=mix(col,dayCol,dayMask);',
  ' float spec=pow(0.5+0.5*sin(6.2831*sheen+u_t*0.6),3.0);',
  ' col+=spec*0.18*(0.2+twMask)*vec3(0.80,0.85,0.90);',   // quicksilver specular band
  ' col*=0.55+0.45*nz;',                                   // limb darkening (roundness)
  ' float key=pow(max(0.0,dot(normalize(n),normalize(vec3(-0.4,0.4,0.8)))),2.0);',
  ' col+=key*0.10*(0.3+dayMask);',
  ' col+=u_bloom*0.25*u_flareCol*(0.4+dayMask);',          // transient sunrise bloom
  ' vec3 retroCol=vec3(0.62,0.40,0.95);',            // cool violet-white "impossible" cue
  ' col=mix(col,retroCol,u_retro*0.45*(0.4+twMask));',
  ' col+=u_retro*0.10*vec3(0.9,0.85,1.0);',
  ' float rim=smoothstep(0.86,1.0,r);',
  ' col+=rim*0.06*u_flareCol;',
  ' float a=smoothstep(1.0,0.985,r);',
  ' gl_FragColor=vec4(col,a);',
  '}'].join('\n');

export default function MercuryTerminator({ twilight = 0, day = 0, flare = null, retrograde = null, onRetrogradeDone = null, size = 180, onClick, title, className = '', ariaLabel }) {
  const canvasRef = useRef(null);
  const twRef = useRef(twilight);
  const dayRef = useRef(day);
  const flareRef = useRef(flare);
  const retroRef = useRef(retrograde);
  const doneRef = useRef(onRetrogradeDone);

  const curRef = useRef(null);
  const { snap } = useShaderCanvas(canvasRef, {
    version: 1,
    contextOptions: { alpha: true, premultipliedAlpha: false, antialias: true },
    strategy: 'legacy',
    blend: 'straight',
    vs: VS,
    fs: FS,
    uniforms: ['u_t', 'u_tw', 'u_day', 'u_bloom', 'u_flareCol', 'u_retro'],
    pixelSize: size,
    setStyleSize: false,
    loseContextOnDispose: true,
    label: 'MercuryTerminator',
    dtClamp: 0.05,
    seedLast: 'now',
    watchdogMs: 40,
    trackVisibility: false,
    haltOnReducedMotion: true,
    initialDraw: true,
    deps: [size],

    // Today's effect recreates `cur` every time it re-runs. onInit fires on the
    // same schedule, so the easing state and the GL host are rebuilt together.
    onInit() {
      curRef.current = {
        tw: twRef.current, day: dayRef.current, bloom: 0, col: CYAN.slice(),
        lastFlareTs: 0, retroTs: 0, retroStart: 0, retroTint: 0,
      };
    },

    draw(host, { dt, tsec, now, reducedMotion }) {
      paint(host, curRef.current, tsec, { dt, now, reducedMotion });
    },

    onSnap(host) {
      const cur = curRef.current;
      if (!cur) return;
      cur.tw = twRef.current; cur.day = dayRef.current; cur.bloom = 0;
      paint(host, cur, 0, { dt: 0, now: 0, reducedMotion: true });
    },
  });

  function paint(host, cur, tsec, { dt, now, reducedMotion }) {
    const { gl, U } = host;
    const lerp = (a, b, t) => a + (b - a) * t;

    if (dt > 0) {
      const e = 1 - Math.pow(0.004, dt);
      cur.tw = lerp(cur.tw, twRef.current, e);
      cur.day = lerp(cur.day, dayRef.current, e);
      const f = flareRef.current;
      if (f && f.ts !== cur.lastFlareTs) {
        cur.lastFlareTs = f.ts;
        cur.bloom = 1;
        cur.col = (f.kind === 'run' ? GOLD : CYAN).slice();
      }
      cur.bloom = lerp(cur.bloom, 0, 1 - Math.pow(0.02, dt)); // ~1.5s decay
      // Retrograde event: a new token arms a one-shot double-sunrise. While
      // it runs the terminator follows base + curve delta, then re-attaches
      // to the true tw/day. Under reduced motion the loop never runs, so an
      // earned token is left set with no visible event — known, phase 2.
      const r = retroRef.current;
      if (r && r.ts !== cur.retroTs && !reducedMotion) { cur.retroTs = r.ts; cur.retroStart = now; }
      if (cur.retroStart) {
        const p = (now - cur.retroStart) / RETROGRADE_MS;
        if (p >= 1) { cur.retroStart = 0; cur.retroTint = 0; doneRef.current?.(); }
        else {
          const { delta, tint } = retrogradeCurve(p);
          cur.tw = Math.max(0, Math.min(1, twRef.current + delta));
          cur.day = Math.max(0, Math.min(1, dayRef.current + delta));
          cur.retroTint = tint;
        }
      }
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.u_t, tsec);
    gl.uniform1f(U.u_tw, cur.tw);
    gl.uniform1f(U.u_day, cur.day);
    gl.uniform1f(U.u_bloom, cur.bloom);
    gl.uniform3fv(U.u_flareCol, new Float32Array(cur.col));
    gl.uniform1f(U.u_retro, cur.retroTint);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Props-sync: the draw loop reads live props through refs, so this effect
  // is the only thing that keeps them current. Declared after the hook so
  // read order matches execution order — snap() is defined above by the time
  // this runs. (Under normal motion snap() is a no-op; it repaints only when
  // prefers-reduced-motion has halted the loop.)
  useEffect(() => {
    twRef.current = twilight; dayRef.current = day; flareRef.current = flare;
    retroRef.current = retrograde;
    doneRef.current = onRetrogradeDone;
    snap();
  }, [twilight, day, flare, retrograde, onRetrogradeDone]);

  return (
    <div
      className={className}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
      title={title}
      style={{ width: size, height: size, position: 'relative', display: 'grid', placeItems: 'center', cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
    </div>
  );
}

// Observer Eye shaders + uniform list. Plain JS (no JSX/React) so node scripts
// (scripts/eyeParity.mjs) can import the exact source the component compiles.
//
// Every term added after v1 (scripts/fixtures/observerEyeFS.v1.glsl) is
// multiplied by, or branched on, its own uniform, so all-zero new uniforms
// reproduce v1's pixels (eyeParity gates it). Budget: still exactly 4 fbm
// calls × 5 octaves, no textures; the additions are cheap analytic terms.
//
// u_phase replaces v1's `u_t*u_speed` swirl phase. JS integrates it
// (phase += speed·dt), so a speed change never shifts the phase by u_t·Δspeed
// (which made transitions spin faster the longer the page had been open).

// Reaction primitives (spec §5.5). `u_kickKind` carries one of these.
export const KICK = {
  inhale: 1, miosis: 2, merge: 3, split: 4, quantize: 5, ring: 6, sag: 7,
  ripple: 8, packet: 9, stare: 10, shove: 11, spiral: 12, sweep: 13, flutter: 14,
};

export const VS = 'attribute vec2 a;varying vec2 v;void main(){v=a;gl_Position=vec4(a,0.,1.);}';
export const FS = [
  'precision highp float;varying vec2 v;',
  'uniform float u_t,u_focus,u_irid,u_speed,u_pulse;uniform vec3 c0,c1,c2;uniform vec2 u_gaze;',
  'uniform float u_core,u_orbit,u_shimmer,u_thread,u_turb,u_kick,u_kickKind,u_kickDir,u_phase;',
  'float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.5);return fract(p.x*p.y);}',
  'float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
  ' float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));',
  ' return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}',
  'float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(.8,.6,-.6,.8);',
  ' for(int i=0;i<5;i++){s+=a*vn(p);p=m*p*2.0;a*=.5;}return s;}',
  'bool isK(float k){return abs(u_kickKind-k)<0.5;}',
  'void main(){',
  ' float K=u_kick,kd=u_kickDir;',
  ' float fk=u_focus;vec2 g=u_gaze;float swk=0.0;',
  ' if(K>0.0){',                                         // kicks that move the eye itself
  '  if(isK(1.)) fk-=0.30*K;',                            // inhale: brief dilation
  '  if(isK(2.)){fk=mix(fk,0.86,K);swk+=1.4*K;}',          // miosis: collapse inward
  '  if(isK(7.)) fk-=0.22*K;',                            // sag: focus drops
  '  if(isK(10.)){fk=mix(fk,0.75,K);g*=1.0-K;}',           // stare: gaze to centre, iris narrows
  '  if(isK(11.)) swk+=kd*2.4*K;',                        // shove: rotation jerks, coasts back
  '  if(u_kickKind>11.5) fk=mix(fk,0.75,K);',              // vertebrae: deep contraction
  ' }',
  ' vec2 uv=v-g;',
  ' float r=length(uv);',
  ' float ang=atan(uv.y,uv.x);',
  ' float sw=u_phase+(1.0/(r+0.16))*(0.55+fk*1.5)*(1.0+0.6*u_orbit);',
  ' if(K>0.0&&isK(4.)) sw+=K*1.3*sin(3.0*ang+kd*u_t*1.5);', // split: the swirl forks into lobes
  ' sw+=swk;',
  ' float ca=cos(sw),sa=sin(sw);vec2 sp=mat2(ca,-sa,sa,ca)*uv;',
  ' float wq=(1.0-0.8*u_orbit)+0.9*u_turb;',
  ' vec2 q=vec2(fbm(sp*1.7+u_t*0.05), fbm(sp*1.7+vec2(5.2,1.3)-u_t*0.045));',
  ' float n=fbm(sp*2.3+q*(1.9*wq)+u_t*0.03);',
  ' float m=fbm(sp*1.5+q*(1.3*wq)+vec2(2.0));',
  ' n=clamp(n,0.,1.);',
  ' if(K>0.0&&isK(5.)){float L=smoothstep(0.25,0.55,K);', // quantise: bands posterise (lattice lock)
  '  n=mix(n,floor(n*5.0)/5.0+0.1,L);m=mix(m,floor(m*4.0)/4.0,L);}',
  ' vec3 col=mix(c0,c1,smoothstep(0.30,0.78,n));',
  ' col=mix(col,c2,smoothstep(0.55,0.98,m)*0.7);',
  ' col*=(0.30+1.25*n);',
  ' float discR=mix(0.98,0.56,fk);',
  ' float coreR=mix(0.14,0.30,fk);',
  ' float cl=clamp(u_core,0.,1.);',                       // star-core lifts the dark pupil
  ' col*=mix(smoothstep(coreR*0.35,coreR,r),1.0,cl);',
  ' col*=1.0-smoothstep(discR*0.72,discR,r);',
  ' if(u_irid>0.001){',
  '  float sweep=0.5+0.5*sin(ang*3.0+u_t*0.5);',
  '  vec3 silver=vec3(0.70,0.75,0.80)*(0.45+0.7*n);',
  '  vec3 spec=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.66)+ang/6.2831+u_t*0.04));',
  '  vec3 rec=silver+spec*0.20*sweep;',
  '  rec*=mix(smoothstep(0.05,0.14,r),1.0,cl);',
  '  rec*=1.0-smoothstep(0.90,1.0,r);',
  '  col=mix(col,rec,u_irid);',
  ' }',
  ' if(K>0.0){',                                         // kicks that paint over the nebula
  '  if(isK(3.)){vec2 p=0.42*K*vec2(cos(u_t*3.0*kd),sin(u_t*3.0*kd));', // merge: counter-rotating lobes
  '   vec2 d1=uv-p,d2=uv-vec2(-p.x,p.y);',
  '   col+=K*(exp(-dot(d1,d1)/0.012)+exp(-dot(d2,d2)/0.012))*mix(c0,vec3(1.0),0.3)*0.9;}',
  '  if(isK(4.)) col*=1.0-K*0.45*(0.5+0.5*cos(3.0*ang+kd*u_t*1.5));',
  '  if(isK(6.)){float rr=0.04+0.9*(1.0-K);',              // ring: outward burst from the core
  '   col+=K*exp(-pow((r-rr)/0.045,2.0))*mix(c0,vec3(1.0,0.93,0.75),0.55)*1.5;}',
  '  if(isK(7.)) col=mix(col,dot(col,vec3(0.30,0.59,0.11))*vec3(0.62,0.74,0.60),0.6*K);', // sag: drain
  '  if(isK(8.)) col*=1.0+K*0.4*sin(r*42.0-u_t*9.0)*smoothstep(0.08,0.2,r);',  // ripple: water
  '  if(isK(9.)){float rr=0.05+0.85*K;',                   // packet: one bright ring travelling in
  '   col+=K*exp(-pow((r-rr)/0.03,2.0))*mix(c2,vec3(1.0),0.4)*1.6;}',
  '  if(isK(12.)){float s=pow(0.5+0.5*cos(2.0*ang+14.0*r+kd*u_t*6.0),6.0);', // spiral infall (accretion)
  '   col+=K*s*(1.0-smoothstep(0.15,0.92,r))*c0*0.9;}',
  '  if(isK(13.)){float e=mix(1.1,-1.1,K);float x=kd<0.0?-uv.x:uv.x;', // terminator sweep (lunar)
  '   col*=1.0-0.8*smoothstep(e-0.1,e+0.1,x);}',
  '  if(isK(14.)) col*=1.0+K*0.55*cos(2.0*ang)*sin(u_t*31.0);', // two-lobed flutter (bsky)
  '  if(u_kickKind>11.5) col*=1.0+0.6*K*K*K;',             // vertebrae: sharp pulse
  ' }',
  ' if(u_shimmer>0.0){',                                 // ridge glints: gold / ice / violet
  '  vec3 w=0.5+0.5*cos(6.2831*(ang/6.2831*2.0+u_t*0.07-vec3(0.0,0.3333,0.6667)));w*=w;',
  '  vec3 sc=(vec3(1.0,0.92,0.7)*w.x+vec3(0.85,0.95,1.0)*w.y+vec3(0.8,0.7,1.0)*w.z)/(w.x+w.y+w.z+1e-4);',
  '  col+=u_shimmer*smoothstep(0.78,0.92,n)*sc*0.9;',
  ' }',
  ' if(u_thread>0.0){',                                  // teal filament riding the silver sweep
  '  float ph=ang+u_t*0.16667+r*2.5+(n-0.5)*0.7;',
  '  float ln=exp(-(1.0-cos(ph))/0.006)*smoothstep(0.12,0.22,r)*(1.0-smoothstep(0.78,0.9,r));',
  '  col=mix(col,vec3(0.078,0.722,0.651),u_thread*0.35*ln);',
  ' }',
  ' col+=u_core*(exp(-r*r/0.001225)+0.25*exp(-r*r/0.0144))*vec3(1.0,0.9,0.62);', // star-core pinpoint
  ' col*=1.0+u_pulse*0.08*(1.0-cos(u_t*2.61799));',   // raised-cosine on 2π/2.4s — co-peaks with nav-beat's 50% keyframe
  ' float a=1.0-smoothstep(0.93,1.0,r);',
  ' gl_FragColor=vec4(col,a);',
  '}'].join('\n');

export const UNIFORMS = [
  'u_t', 'u_focus', 'u_irid', 'u_speed', 'u_pulse', 'c0', 'c1', 'c2', 'u_gaze',
  'u_core', 'u_orbit', 'u_shimmer', 'u_thread', 'u_turb', 'u_kick', 'u_kickKind', 'u_kickDir', 'u_phase',
];

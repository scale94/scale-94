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
  watch: 15,   // neutral: no shader term of its own (a timeline moves gaze / focus)
};

// Shape morphs (u_shape). The pupil/disc *become* a figure by SDF blends, the nebula
// keeps flowing inside it. u_shapeK 0..1 = how far; u_shapeA/B are per-shape params.
export const SHAPE = { kernel: 1, butterfly: 2, antenna: 3, horizon: 4, accord: 5, sun: 6, cipher: 7, feigen: 8, vessels: 9 };

export const VS = 'attribute vec2 a;varying vec2 v;void main(){v=a;gl_Position=vec4(a,0.,1.);}';
export const FS = [
  'precision highp float;varying vec2 v;',
  'uniform float u_t,u_focus,u_irid,u_speed,u_pulse;uniform vec3 c0,c1,c2;uniform vec2 u_gaze;',
  'uniform float u_core,u_orbit,u_shimmer,u_thread,u_turb,u_kick,u_kickKind,u_kickDir,u_phase;',
  'uniform float u_shape,u_shapeK,u_shapeA,u_shapeB,u_shapeC,u_px,u_fore;',
  'uniform float u_rim;uniform vec3 u_rimCol;',
  'float aa(float d){return clamp(0.5-d/max(u_px,1e-4),0.,1.);}',  // 1 inside (d<0), ~1px AA
  // A 2D hash; convection cells (/SOL): F1 Worley over a 3x3 neighbourhood, centres drifting.
  'vec2 h22(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}',
  'float wor(vec2 p,float t){vec2 i=floor(p),f=fract(p);float d=1.0;',
  ' for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));',
  '  vec2 o=0.5+0.42*sin(t+6.2831*h22(i+g));d=min(d,length(g+o-f));}return d;}',
  'float sdBox(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}',
  'float sdEll(vec2 p,vec2 c,vec2 r,float a){p-=c;float cs=cos(a),sn=sin(a);p=mat2(cs,sn,-sn,cs)*p;',
  ' return (length(p/r)-1.0)*min(r.x,r.y);}',
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
  '  if(u_kickKind>11.5&&u_kickKind<14.5) fk=mix(fk,0.75,K);', // vertebrae: deep contraction
  ' }',
  // cipher (/CRYPTOGRAPHY): the eye is cut into ~4 px blocks before anything is sampled.
  // A = chaos (blocks jump, rows shear and jitter), B >= 0 = the re-deal clock (blocks
  // re-deal each integer step; B < 0: the seal burst, radius -B), C = order (the lattice).
  // Skipped unless u_shape is the cipher (v1 parity).
  ' vec2 vv=v;float cz=(u_shape>6.5&&u_shape<7.5)?clamp(u_shapeK,0.,1.):0.0;',
  ' if(cz>0.0&&u_shapeA>0.0){float st=floor(max(u_shapeB,0.0));vec2 cb=floor(v/0.22);vec2 hb=h22(cb+st*vec2(1.7,3.1));',
  '  vv+=cz*u_shapeA*(hb-0.5)*0.42;',
  '  vv.x+=cz*u_shapeA*0.34*(0.6+0.4*sin(u_t*31.0))*sin(cb.y*2.7+st*1.3);}',
  // vessels (/ECOCIDE), all inside the fluid: A = arterial pressure, B = haemorrhage,
  // C = calm. The pupil follows (pinprick under pressure, wide when soothed) and a breach
  // strains the whole eye. Every term is x vz, so any other shape is untouched (v1 parity).
  ' float vz=(u_shape>8.5&&u_shape<9.5)?clamp(u_shapeK,0.,1.):0.0;',
  ' float vA=vz*clamp(u_shapeA,0.,1.),vB=vz*clamp(u_shapeB,0.,1.),vC=vz*clamp(u_shapeC,0.,1.);',
  ' float ps=1.0-0.66*clamp(0.5*vA+0.7*vB,0.,1.)+0.95*vC;',
  ' vv+=vB*0.025*vec2(sin(u_t*53.0)+0.5*sin(u_t*97.0),sin(u_t*47.0+1.3)+0.5*sin(u_t*89.0));',
  ' vec2 uv=vv-g;',
  // Foreshortening: a gazing eye narrows along its gaze so the shifted disc (radius 1)
  // still ends at the canvas edge instead of being sliced flat. 0 = v1 (parity).
  ' float gl=length(g);if(u_fore>0.0&&gl>1e-4){vec2 gd=g/gl;uv+=gd*dot(uv,gd)*(u_fore*gl/(1.0-min(gl,0.9)));}',
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
  ' float coreR=mix(0.14,0.30,fk)*ps;',
  ' float cl=clamp(u_core,0.,1.);',                       // star-core lifts the dark pupil
  // A figure that *is* the pupil (butterfly) lifts the round pupil out from under itself.
  ' float fig=(u_shape>1.5&&u_shape<2.5)?clamp(u_shapeK,0.,1.):0.0;',
  ' col*=mix(mix(smoothstep(coreR*0.35,coreR,r),1.0,cl),1.0,fig);',
  ' col*=1.0-smoothstep(discR*0.72,discR,r);',
  ' if(u_irid>0.001){',
  '  float sweep=0.5+0.5*sin(ang*3.0+u_t*0.5);',
  '  vec3 silver=vec3(0.70,0.75,0.80)*(0.45+0.7*n);',
  '  vec3 spec=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.66)+ang/6.2831+u_t*0.04));',
  '  vec3 rec=silver+spec*0.20*sweep;',
  '  rec*=mix(mix(smoothstep(0.05*ps,0.14*ps,r),1.0,cl),1.0,fig);',
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
  '  if(u_kickKind>11.5&&u_kickKind<14.5) col*=1.0+0.6*K*K*K;', // vertebrae: sharp pulse
  ' }',
  ' if(u_shimmer>0.0){',                                 // ridge glints: gold / ice / violet
  '  vec3 w=0.5+0.5*cos(6.2831*(ang/6.2831*2.0+u_t*0.07-vec3(0.0,0.3333,0.6667)));w*=w;',
  '  vec3 sc=(vec3(1.0,0.92,0.7)*w.x+vec3(0.85,0.95,1.0)*w.y+vec3(0.8,0.7,1.0)*w.z)/(w.x+w.y+w.z+1e-4);',
  '  col+=u_shimmer*smoothstep(0.78,0.92,n)*sc*0.9;',
  ' }',
  // Sealed cue: a broad thin-film sheen drifting over the silver, never a drawn line.
  // Resting-only: × u_irid (0 in every coloured state), killed by any reaction or storm.
  ' float thG=u_thread*u_irid*(1.0-clamp(u_kick,0.,1.))*(1.0-clamp(u_turb,0.,1.));',
  ' if(thG>0.001){',
  '  float ph=ang-u_t*0.11+r*1.6+(n-0.5)*1.2;',
  '  float band=pow(0.5+0.5*cos(ph),4.0)*smoothstep(0.16,0.34,r)*(1.0-smoothstep(0.70,0.90,r));',
  '  vec3 film=0.5+0.5*cos(6.2831*(n*1.4+r*0.9+u_t*0.025+vec3(0.0,0.33,0.67)));',
  '  col+=thG*band*(film-0.35)*0.22*(0.5+0.5*n);',
  ' }',
  ' col+=u_core*(exp(-r*r/0.001225)+0.25*exp(-r*r/0.0144))*vec3(1.0,0.9,0.62);', // star-core pinpoint
  ' col*=1.0+u_pulse*0.08*(1.0-cos(u_t*2.61799));',   // raised-cosine on 2π/2.4s — co-peaks with nav-beat's 50% keyframe
  ' float a=1.0-smoothstep(0.93,1.0,r);',
  ' if(u_shape>0.5&&u_shapeK>0.0){float k=clamp(u_shapeK,0.,1.);vec3 lit=mix(c0,vec3(1.0),0.55);',
  '  if(u_shape<1.5){',                                    // kernel: disc -> chip package, pupil -> diamond die
  '   float frame=sdBox(uv,vec2(0.62))-0.14;',
  '   float pins=1e3;for(int i=-1;i<=1;i++){pins=min(pins,sdBox(uv-vec2(float(i)*0.36,0.0),vec2(0.055,0.97)));}',
  '   a=mix(a,aa(min(frame,pins)),k);',
  '   float cb=cos(u_shapeB),sb=sin(u_shapeB);vec2 du=mat2(cb,-sb,sb,cb)*uv;',  // B = die spin (rad)
  '   float die=(abs(du.x)+abs(du.y))*0.7071-0.26;',
  '   col*=mix(1.0,0.55+0.45*smoothstep(-0.02,0.12,frame+0.12),k);',
  '   col=mix(col,col*0.08,k*aa(die));',
  '   col=mix(col,lit*(0.45+0.9*n),k*aa(abs(frame+0.06)-0.055));',
  '   col=mix(col,lit*(0.55+0.7*m),k*aa(abs(die)-0.035));',
  '   col=mix(col,lit*(0.4+0.8*n),k*aa(pins)*(1.0-aa(frame)));',
  '  }else if(u_shape<2.5){',                              // butterfly: A = rise 0..1, B = wing flap phase
  '   float bs=1.5*mix(1.0,0.55,u_shapeA);',               // size: fills the open pupil, shrinks as it flies
  '   vec2 p=(uv-vec2(0.0,u_shapeA*0.75))/bs;',
  '   float fl=0.55+0.45*abs(cos(u_shapeB));',
  '   vec2 q=vec2(abs(p.x)/fl,p.y);',
  '   float w=min(sdEll(q,vec2(0.25,0.15),vec2(0.25,0.17),0.35),sdEll(q,vec2(0.16,-0.15),vec2(0.15,0.11),-0.45));',
  '   float sd=min(w*fl,sdEll(p,vec2(0.0),vec2(0.028,0.20),0.0))*bs;',  // back to uv units for the 1px AA
  '   float fade=k*(1.0-smoothstep(0.7,1.0,u_shapeA));',
  // A solid silhouette, its wings catching the palette toward the tips (no inner outline:
  // an outline reads as four hollow rings at 64 px).
  '   vec3 wing=vec3(0.015,0.02,0.035)+c2*0.22*smoothstep(0.08,0.42,abs(p.x))*(0.6+0.6*n);',
  '   col=mix(col,wing,fade*aa(sd));',
  '  }else if(u_shape<3.5){',                              // antenna: A = mast extension 0..1, B = broadcast clock (<0: unlit)
  '   float km=k*smoothstep(0.0,0.08,u_shapeA);',
  // The whole assembly sits 0.19 (~3.5 CSS px) low: the base inside the pupil, not on its rim.
  '   vec2 au=uv+vec2(0.0,0.19);',
  '   float h=0.76*u_shapeA;vec2 tip=vec2(0.0,h-0.19);',   // the beacon, in the iris' upper third
  // Telescoping, tapered: a lower section out of the pupil (half-width .074 -> .062) and a
  // slimmer upper one (.050 -> .042), each a trapezoid clipped to its span. At 37 CSS px the
  // stem is ~2.7 -> 1.5 px wide: thick enough that the edge ramp is not most of its width.
  '   float yl=clamp(au.y/max(h,1e-3),0.0,1.0);',
  '   float lo=max(abs(au.x)-mix(0.074,0.062,yl/0.6),max(-au.y,au.y-h*0.6));',
  '   float hi=max(abs(au.x)-mix(0.050,0.042,(yl-0.55)/0.45),max(h*0.55-au.y,au.y-h));',
  '   float node=length(uv-tip)-0.072*smoothstep(0.2,0.6,u_shapeA);',
  '   float B=u_shapeB,fl=0.0,rg=0.0,wk=0.0;',
  '   if(B>0.0){float d=length(uv-tip);',                   // three pulses leave the tip, 0.45 apart
  '    for(int i=0;i<3;i++){float b=B-float(i)*0.45;if(b>0.0){',
  '     fl+=exp(-b*7.0);',                                   // the beacon flashes as each one leaves
  '     float fa=1.0-smoothstep(1.1,1.9,b);',
  '     rg+=fa*exp(-pow((d-b)/0.045,2.0));',
  '     wk+=fa*exp(-pow((d-b+0.12)/0.14,2.0));}}}',
  '   rg*=1.0-smoothstep(0.80,0.97,max(abs(v.x),abs(v.y)));', // fade before the square canvas edge cuts it
  '   vec3 hot=mix(c0,vec3(1.0),0.65);',
  '   col*=1.0+k*0.45*wk*(0.6+0.8*n);',                     // the liquid lifts in each wave's wake
  '   col+=k*rg*hot*1.4;',
  '   a=max(a,k*clamp(rg,0.,1.)*0.85);',                    // the waves carry on past the rim
  // Pitch-black mast: the pupil itself reaching up. Only the tip is lit.
  '   float dt=length(uv-tip);',
  '   col+=km*exp(-dt*dt/0.012)*hot*(0.35+0.9*fl);',       // the beacon's glow on the liquid (under the mast,
  // so the stem stays black up to the beacon)
  '   col=mix(col,vec3(0.0),km*clamp(0.5-min(lo,hi)/(0.6*max(u_px,1e-4)),0.,1.));', // hard edge: 0.6 px ramp
  '   col=mix(col,mix(hot,vec3(1.0),0.35)*(1.3+2.2*fl),km*aa(node));',
  '  }else if(u_shape<4.5){',                              // horizon: A = event-horizon radius, B = the swallowing front
  '   col*=mix(1.0,1.0-smoothstep(u_shapeB-0.10,u_shapeB+0.02,r),k);', // the rim goes dark, outside in
  '   float pr=r-u_shapeA*1.16;',                          // photon ring, just outside the horizon
  // A charged hum while it holds: brightness running round the ring, and a fine flicker.
  '   float hum=0.80+0.20*sin(ang*3.0-u_t*4.2)+0.07*sin(u_t*19.0+ang);',
  '   col+=k*smoothstep(0.03,0.14,u_shapeA)*exp(-pr*pr/0.0011)*mix(c0,vec3(1.0),0.6)*2.0*hum;',
  '   col=mix(col,vec3(0.0),k*aa(r-u_shapeA));',
  '   if(u_shapeC>0.0){float E=u_shapeC,er=r-E;',           // C = the ejection: a burst out of the dark core
  '    float ef=(1.0-smoothstep(0.75,1.15,E))*(1.0-smoothstep(0.80,0.97,max(abs(v.x),abs(v.y))));',
  '    float eb=exp(-er*er/0.004)*ef;',
  '    col+=k*eb*mix(c0,vec3(1.0),0.75)*2.4;',
  '    col+=k*exp(-r*r/0.006)*exp(-E*9.0)*vec3(1.0,0.95,1.0)*2.0;',   // the core flash as it leaves
  '    a=max(a,k*eb*0.8);}',
  '  }else if(u_shape<5.5){',                              // accord: A = lobe orbit radius, B = orbit angle, C = seconds since the collision (0 = not yet)
  '   float mg=smoothstep(0.0,0.08,u_shapeC);',            // after the collision the two are one accord
  '   float sd=smoothstep(-0.3,0.3,sin(ang+3.5*r-u_shapeB));', // a two-arm swirl: half accord A, half B
  '   vec3 tn=mix(mix(c0,c1,sd),mix(c0,c1,0.5),mg);',
  '   vec3 lw=vec3(0.30,0.59,0.11);',                      // recolour, keeping the nebula's light + pupil
  '   col=mix(col,tn*(dot(col,lw)/max(dot(tn,lw),0.05)),k*0.9);',
  '   if(u_shapeA>0.001){vec2 p=u_shapeA*vec2(cos(u_shapeB),sin(u_shapeB));', // the two lobes, spiralling in
  '    vec2 d1=uv-p,d2=uv+p;float g1=exp(-dot(d1,d1)/0.024),g2=exp(-dot(d2,d2)/0.024);',
  // Each glows in its own accord's colour; only a small hot centre goes white.
  '    col+=k*(1.0-mg)*(1.25*(g1*c0+g2*c1)+0.45*(g1*g1*g1+g2*g2*g2)*vec3(1.0));}',
  // The collision: a flash, then three waves 0.15 s apart, like the collider's own pulses,
  // in the blended accord colour, each weaker than the last (radius eases out over 0.55 s).
  '   if(u_shapeC>0.0){float C=u_shapeC,ec=1.0-smoothstep(0.80,0.97,max(abs(v.x),abs(v.y)));',
  '    vec3 acc=mix(mix(c0,c1,0.5),vec3(1.0),0.3);float wv=0.0;',
  '    for(int i=0;i<3;i++){float te=C-float(i)*0.15;if(te>0.0){',
  '     float e=min(1.0,te/0.55);float E=0.02+1.15*(1.0-(1.0-e)*(1.0-e)*(1.0-e));float er=r-E;',
  '     wv+=pow(0.62,float(i))*exp(-er*er/0.0035)*(1.0-smoothstep(0.75,1.15,E));}}',
  '    wv*=ec;',
  '    col+=k*wv*acc*2.2;',
  '    col+=k*exp(-r*r/0.008)*exp(-C*16.0)*vec3(1.0,0.97,0.92)*2.2;',   // the merge flash
  '    a=max(a,k*min(wv,1.0)*0.8);}',
  '  }else if(u_shape<6.5){',                              // sun: A = magnetic tension 0..1, C = seconds since the snap (0 = held)
  // The cells turn with the eye's spin (u_phase, which the stir drives) - not the swirl
  // frame, whose radial twist smears them into a pinwheel - plus tension's own twist.
  '   float A=clamp(u_shapeA,0.,1.),tw=u_phase+A*2.6*(1.0-r)*(1.0-r);',
  '   vec2 gp=mat2(cos(tw),-sin(tw),sin(tw),cos(tw))*uv;',
  '   float g=wor(gp*mix(5.2,7.0,A),u_t*0.7);',
  '   float cell=1.0-smoothstep(0.42,0.78,g);',               // packed granules, thin dark lanes
  '   vec3 sun=mix(c1*0.45,c0*1.4,cell)*(0.75+0.5*n);',
  '   sun+=A*A*cell*vec3(1.0,0.92,0.75)*0.55*(0.6+0.4*sin(u_t*23.0+n*9.0));', // near the snap: white-hot, flickering
  '   sun*=(1.0-smoothstep(discR*0.72,discR,r))*mix(smoothstep(coreR*0.35,coreR,r),1.0,cl);',
  '   col=mix(col,sun,k);',
  '   if(u_shapeC>0.0){float C=u_shapeC,e=min(1.0,C/0.6);',   // the snap: a solar-wind burst outward
  '    float E=0.05+1.2*(1.0-(1.0-e)*(1.0-e)*(1.0-e)),er=r-E;',
  '    float fo=(1.0-smoothstep(0.8,1.2,E))*(1.0-smoothstep(0.80,0.97,max(abs(v.x),abs(v.y))));',
  '    float rg=exp(-er*er/0.004);',
  '    float st=pow(0.5+0.5*cos(ang*13.0+2.0*sin(ang*5.0+1.3)),6.0)*smoothstep(E-0.55,E-0.03,r)*(1.0-smoothstep(E-0.03,E+0.04,r));',
  '    float w=(rg+0.9*st)*fo;',
  '    col+=k*w*mix(c0,vec3(1.0),0.5)*2.1;',
  '    col+=k*exp(-r*r/0.01)*exp(-C*10.0)*vec3(1.0,0.95,0.8)*2.0;',   // the flare at the core
  '    a=max(a,k*min(w,1.0)*0.85);}',
  '  }else if(u_shape<7.5){',                              // cipher: chaos flickers + tears; order is a humming lattice
  '   float st=floor(max(u_shapeB,0.0));vec2 cb=floor(v/0.22);vec2 hb=h22(cb+st*vec2(1.7,3.1));',
  '   vec3 hot=mix(c0,vec3(1.0),0.4);',
  '   col*=1.0+k*u_shapeA*0.6*(hb.x-0.5);',
  '   col+=k*u_shapeA*0.55*step(0.92,fract(v.y*8.0+st*0.37))*hot;',
  '   float O=clamp(u_shapeC,0.,1.);',
  '   if(O>0.0){vec2 fq=abs(fract(v/0.22)-0.5);',              // the lattice: block edges, a travelling beat
  '    float ln=aa(0.5-max(fq.x,fq.y)-0.035);',
  '    float pz=0.5+0.5*sin(u_t*13.8-(cb.x+cb.y)*0.9);',     // ~2.2 Hz, running diagonally (the NTT butterflies)
  '    col*=1.0+k*O*0.22*(pz-0.5);',
  '    col+=k*O*ln*hot*(0.25+0.75*pz*pz)*0.9*(1.0-smoothstep(0.86,1.0,r));}',
  '   if(u_shapeB<0.0){float E=-u_shapeB,er=r-E;',            // the seal burst: one crisp ring out
  '    float eb=exp(-er*er/0.0035)*(1.0-smoothstep(0.8,1.15,E))*(1.0-smoothstep(0.80,0.97,max(abs(v.x),abs(v.y))));',
  '    col+=k*eb*hot*2.3;a=max(a,k*eb*0.8);}',
  // feigen (/CHAOS): period doubling. A = doublings (floor = level, 2^level lobes; fract =
  // the split in progress), B = lobe phase, C = chaos. Every lobe at c splits to c ± π/2L and
  // narrows as it goes, so a finished split IS the next level's lobes (no jump between them).
  '  }else if(u_shape<8.5){',
  '   float lv=floor(u_shapeA),sp=smoothstep(0.0,1.0,fract(u_shapeA)),L=exp2(lv);',
  '   float an=ang+2.2*r+u_shapeB,o=sp*3.14159265/(2.0*L),w=1.7279/(L*exp2(sp));',
  '   float cf=lv<0.5?0.0:3.14159265/L,P=0.0;',
  '   for(int i=0;i<16;i++){if(float(i)>=L)break;float cc=cf+6.2831853*float(i)/L;',
  '    float d1=mod(an-cc-o+3.14159265,6.2831853)-3.14159265,d2=mod(an-cc+o+3.14159265,6.2831853)-3.14159265;',
  '    P=max(P,exp(-min(d1*d1,d2*d2)/(w*w)));}',
  '   float C=clamp(u_shapeC,0.,1.);P=mix(P,n*n*1.6,C);',      // past the accumulation point: chaos
  '   col*=mix(1.0,0.28+1.45*P,k);',
  '   col+=k*P*(1.0-0.6*C)*mix(c0,vec3(1.0),0.3)*0.35*smoothstep(0.1,0.3,r)*(1.0-smoothstep(discR*0.7,discR,r));',
  // vessels: nothing is drawn on the metal; the blood is in it. Pressure (A) catches a deep
  // arterial crimson in the fluid's own ridges (n), lit by the metal's own luminance, beating
  // faster as it climbs. Haemorrhage (B): dark ink-blooms in the swirled frame (sp, warped by
  // q), so the rotation carries and shears them like dye in spinning mercury; each region
  // swells and bursts in turn. C: a luminous sage-emerald calm around a wide pupil.
  '  }else if(u_shape<9.5){',
  '   float A=clamp(u_shapeA,0.,1.),B=clamp(u_shapeB,0.,1.),C=clamp(u_shapeC,0.,1.);',
  '   float pR=0.14*ps;',
  '   float body=smoothstep(pR*1.05,pR*1.8,r)*(1.0-smoothstep(0.86,0.97,r));',
  '   float lum=dot(col,vec3(0.30,0.59,0.11));',
  '   if(A>0.001){float ridge=smoothstep(0.34,0.76,n);',
  '    float beat=0.80+0.20*sin(u_t*(2.6+5.0*A+5.0*B));',
  '    vec3 art=vec3(0.80,0.02,0.06);',
  '    col=mix(col,art*(0.25+1.2*lum)*beat,k*body*clamp(1.5*A*(0.35+0.65*ridge),0.,1.));',
  '    col+=k*body*A*ridge*art*0.22*beat;}',
  '   if(B>0.001){vec2 ip=sp*2.4+q*2.6;',
  '    float I=fbm(ip+vec2(7.3,2.1));',
  '    float pop=0.5+0.5*sin(u_t*1.3+6.2831*vn(sp*1.1+vec2(4.0,9.0)));',
  '    float th=0.70-0.22*B-0.08*pop;',
  '    float ink=smoothstep(th,th+0.07,I)*body;',
  '    col=mix(col,vec3(0.24,0.0,0.02)*(0.45+0.9*lum),k*clamp(ink*(0.6+0.5*B),0.,1.));}',
  '   if(C>0.001){float halo=smoothstep(pR,pR*1.6,r)*(1.0-smoothstep(0.55,0.95,r));',
  '    col+=k*C*vec3(0.30,1.0,0.58)*(0.18+0.32*n)*halo;',
  '    col+=k*C*vec3(0.45,1.0,0.7)*0.5*exp(-pow((r-pR*1.25)/0.05,2.0));}',
  '  }',
  ' }',
  // Rim (eyeDrive driveRim; /ECOCIDE's protection protocol): a luminous corona hugging the
  // iris edge, made of the fluid: lit by n, its light running round the ring through the
  // swirl, a bright refractive lip at the edge and a dark groove inside it. The hue is lifted to
  // full light and saturated (pale accents must still part from silver); the strength
  // is drawn on a sqrt curve (a quarter pull already reads). 0: off.
  ' if(u_rim>0.0){',
  '  vec3 rc=u_rimCol/max(max(u_rimCol.r,u_rimCol.g),max(u_rimCol.b,1e-3));',
  '  rc=clamp(mix(vec3(dot(rc,vec3(0.30,0.59,0.11))),rc,1.9),0.,1.);',
  '  float rw=sqrt(clamp(u_rim,0.,1.));',
  '  float band=exp(-pow((r-0.835)/0.105,2.0));',
  '  float flow=0.55+0.45*sin(ang*5.0-u_t*0.7+n*5.0);',
  '  vec3 glow=rc*(0.45+0.85*n);',
  '  col*=1.0-0.4*rw*exp(-pow((r-0.70)/0.035,2.0));',
  '  col=mix(col,glow,rw*band*0.85);',
  '  col+=rw*band*rc*flow*0.35;',
  '  col+=rw*exp(-pow((r-0.93)/0.025,2.0))*mix(rc,vec3(1.0),0.4)*0.8;',
  ' }',
  ' gl_FragColor=vec4(col,a);',
  '}'].join('\n');

export const UNIFORMS = [
  'u_t', 'u_focus', 'u_irid', 'u_speed', 'u_pulse', 'c0', 'c1', 'c2', 'u_gaze',
  'u_core', 'u_orbit', 'u_shimmer', 'u_thread', 'u_turb', 'u_kick', 'u_kickKind', 'u_kickDir', 'u_phase',
  'u_shape', 'u_shapeK', 'u_shapeA', 'u_shapeB', 'u_shapeC', 'u_px', 'u_fore', 'u_rim', 'u_rimCol',
];

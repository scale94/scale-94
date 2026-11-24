precision highp float;varying vec2 v;
uniform float u_t,u_focus,u_irid,u_speed,u_pulse;uniform vec3 c0,c1,c2;uniform vec2 u_gaze;
float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.5);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
 return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(.8,.6,-.6,.8);
 for(int i=0;i<5;i++){s+=a*vn(p);p=m*p*2.0;a*=.5;}return s;}
void main(){
 vec2 uv=v-u_gaze;
 float r=length(uv);
 float ang=atan(uv.y,uv.x);
 float sw=u_t*u_speed+(1.0/(r+0.16))*(0.55+u_focus*1.5);
 float ca=cos(sw),sa=sin(sw);vec2 sp=mat2(ca,-sa,sa,ca)*uv;
 vec2 q=vec2(fbm(sp*1.7+u_t*0.05), fbm(sp*1.7+vec2(5.2,1.3)-u_t*0.045));
 float n=fbm(sp*2.3+q*1.9+u_t*0.03);
 float m=fbm(sp*1.5+q*1.3+vec2(2.0));
 n=clamp(n,0.,1.);
 vec3 col=mix(c0,c1,smoothstep(0.30,0.78,n));
 col=mix(col,c2,smoothstep(0.55,0.98,m)*0.7);
 col*=(0.30+1.25*n);
 float discR=mix(0.98,0.56,u_focus);
 float coreR=mix(0.14,0.30,u_focus);
 col*=smoothstep(coreR*0.35,coreR,r);
 col*=1.0-smoothstep(discR*0.72,discR,r);
 if(u_irid>0.001){
  float sweep=0.5+0.5*sin(ang*3.0+u_t*0.5);
  vec3 silver=vec3(0.70,0.75,0.80)*(0.45+0.7*n);
  vec3 spec=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.66)+ang/6.2831+u_t*0.04));
  vec3 rec=silver+spec*0.20*sweep;
  rec*=smoothstep(0.05,0.14,r);
  rec*=1.0-smoothstep(0.90,1.0,r);
  col=mix(col,rec,u_irid);
 }
 col*=1.0+u_pulse*0.08*(1.0-cos(u_t*2.61799));
 float a=1.0-smoothstep(0.93,1.0,r);
 gl_FragColor=vec4(col,a);
}
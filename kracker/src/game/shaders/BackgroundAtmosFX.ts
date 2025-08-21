// src/game/shaders/BackgroundAtmosFX.ts
export default class BackgroundAtmosFX extends Phaser.Renderer.WebGL.Pipelines
  .PostFXPipeline {
  private _time = 0;
  private _intensity = 0.8;
  private _speed = 1.0;

  constructor(game: Phaser.Game) {
    super({
      game,
      renderTarget: true,
      fragShader: `
      precision mediump float;

      uniform sampler2D uMainSampler;
      uniform vec2  uResolution;
      uniform float uTime;
      uniform float uIntensity;
      uniform float uSpeed;
      varying vec2 outTexCoord;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=hash(i);
        float b=hash(i+vec2(1.,0.));
        float c=hash(i+vec2(0.,1.));
        float d=hash(i+vec2(1.,1.));
        vec2 u=f*f*(3.-2.*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float v=0.0;
        float a=0.5;
        for(int i=0;i<5;i++){
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      void main(){
        vec2 uv = outTexCoord;
        vec2 p = uv*2.0 - 1.0;

        vec4 base = texture2D(uMainSampler, uv);

        float vign = smoothstep(1.2, 0.2, length(p));
        float t = uTime * uSpeed;

        float fog = fbm(uv*3.0 + vec2(0.0, t*0.15)) * 0.7
                  + fbm(uv*6.0 + vec2(t*0.08, 0.0)) * 0.3;
        fog = smoothstep(0.25, 0.85, fog);

        vec2 center = vec2(0.5, 0.1);
        vec2 d = uv - center;
        float ang = atan(d.y, d.x);
        float rays = 0.5 + 0.5*cos(ang*20.0 - t*1.2);
        rays *= smoothstep(0.0, 1.0, 1.0 - length(d)*1.2);

        float grain = noise(uv * uResolution + t*60.0) * 0.04;

        float k = uIntensity;
        vec3 fogColor = vec3(0.05, 0.08, 0.12);
        vec3 col = base.rgb;

        col *= mix(1.0, 0.92, k*(1.0 - vign));
        col = mix(col, fogColor, k * fog * 0.35);
        col += k * rays * 0.12;
        col += grain * k;

        gl_FragColor = vec4(col, base.a);
      }`,
    });
  }

  setIntensity(v: number) {
    this._intensity = v;
  }
  setSpeed(v: number) {
    this._speed = v;
  }

  onPreRender() {
    this._time += this.game.loop.delta / 1000;
    this.set2f("uResolution", this.renderer.width, this.renderer.height);
    this.set1f("uTime", this._time);
    this.set1f("uIntensity", this._intensity);
    this.set1f("uSpeed", this._speed);
  }
}

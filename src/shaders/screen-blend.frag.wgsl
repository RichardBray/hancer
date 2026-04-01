@group(0) @binding(0) var base_tex: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var overlay_tex: texture_2d<f32>;

struct BlendParams {
  opacity: f32,
  hueShift: f32,
  saturation: f32,
  _pad: f32,
};
@group(0) @binding(3) var<uniform> params: BlendParams;

fn rgb2hsv(c: vec3f) -> vec3f {
  let cmax = max(max(c.r, c.g), c.b);
  let cmin = min(min(c.r, c.g), c.b);
  let delta = cmax - cmin;
  var h: f32 = 0.0;
  if (delta > 0.001) {
    if (cmax == c.r) { h = ((c.g - c.b) / delta) % 6.0; }
    else if (cmax == c.g) { h = (c.b - c.r) / delta + 2.0; }
    else { h = (c.r - c.g) / delta + 4.0; }
    h = h / 6.0;
    if (h < 0.0) { h += 1.0; }
  }
  let s = select(0.0, delta / cmax, cmax > 0.0);
  return vec3f(h, s, cmax);
}

fn hsv2rgb(c: vec3f) -> vec3f {
  let h = c.x * 6.0;
  let s = c.y;
  let v = c.z;
  let i = floor(h);
  let f = h - i;
  let p = v * (1.0 - s);
  let q = v * (1.0 - s * f);
  let t = v * (1.0 - s * (1.0 - f));
  let idx = i32(i) % 6;
  if (idx == 0) { return vec3f(v, t, p); }
  if (idx == 1) { return vec3f(q, v, p); }
  if (idx == 2) { return vec3f(p, v, t); }
  if (idx == 3) { return vec3f(p, q, v); }
  if (idx == 4) { return vec3f(t, p, v); }
  return vec3f(v, p, q);
}

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let base = textureSample(base_tex, samp, uv).rgb;
  var overlay = textureSample(overlay_tex, samp, uv).rgb;
  if (params.hueShift != 0.0 || params.saturation != 1.0) {
    var hsv = rgb2hsv(overlay);
    hsv.x = fract(hsv.x + params.hueShift / 360.0);
    hsv.y = clamp(hsv.y * params.saturation, 0.0, 1.0);
    overlay = hsv2rgb(hsv);
  }
  let blended = 1.0 - (1.0 - base) * (1.0 - overlay);
  return vec4f(mix(base, blended, params.opacity), 1.0);
}

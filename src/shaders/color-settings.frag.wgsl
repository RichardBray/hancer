@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct ColorParams {
  contrast: f32,
  brightness: f32,
  saturation: f32,
  gamma: f32,
  whiteBalance: f32,
  tint: f32,
  bleachBypass: f32,
  _pad: f32,
};
@group(0) @binding(2) var<uniform> params: ColorParams;

fn rgb2luma(c: vec3f) -> f32 {
  return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

fn ln(x: f32) -> f32 { return log2(x) / log2(2.718281828); }

fn applyWhiteBalance(color: vec3f, kelvin: f32) -> vec3f {
  if (abs(kelvin - 6500.0) < 1.0) { return color; }
  let t = kelvin / 100.0;
  var r: f32; var g: f32; var b: f32;
  if (t <= 66.0) {
    r = 1.0;
    g = clamp((0.39008 * ln(t) - 0.63184), 0.0, 1.0);
  } else {
    r = clamp(1.292936 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
    g = clamp(1.129891 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
  }
  if (t >= 66.0) {
    b = 1.0;
  } else if (t <= 19.0) {
    b = 0.0;
  } else {
    b = clamp(0.54320 * ln(t - 10.0) - 1.19625, 0.0, 1.0);
  }
  let d65 = vec3f(1.0, 0.9468, 0.9228);
  let wb = vec3f(r, g, b) / d65;
  return color * wb;
}

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let color = textureSample(src, samp, uv).rgb;
  var c = pow(color, vec3f(params.gamma));
  c = (c - 0.5) * params.contrast + 0.5 + params.brightness;
  c = clamp(c, vec3f(0.0), vec3f(1.0));
  let luma = rgb2luma(c);
  c = mix(vec3f(luma), c, params.saturation);
  c = applyWhiteBalance(c, params.whiteBalance);
  c.g = c.g + params.tint * 0.1;
  c = clamp(c, vec3f(0.0), vec3f(1.0));
  if (params.bleachBypass > 0.0) {
    let desat = vec3f(rgb2luma(c));
    let highContrast = (desat - 0.5) * 1.3 + 0.5;
    c = mix(c, clamp(highContrast, vec3f(0.0), vec3f(1.0)), params.bleachBypass);
  }
  return vec4f(c, 1.0);
}

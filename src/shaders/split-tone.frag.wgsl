@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct SplitToneParams {
  shadowR: f32,
  shadowB: f32,
  highlightR: f32,
  highlightB: f32,
  midR: f32,
  amount: f32,
  protectNeutrals: f32,
  _pad: f32,
};
@group(0) @binding(2) var<uniform> params: SplitToneParams;

fn colorbalance_component(v: f32, lightness: f32, shadows: f32, midtones: f32, highlights: f32) -> f32 {
  let a = 4.0;
  let b = 0.333;
  let scale = 0.7;
  let shadow_weight = clamp((b - lightness) * a + 0.5, 0.0, 1.0) * scale;
  let mid_weight_low = clamp((lightness - b) * a + 0.5, 0.0, 1.0);
  let mid_weight_high = clamp((1.0 - lightness - b) * a + 0.5, 0.0, 1.0);
  let highlight_weight = clamp((lightness + b - 1.0) * a + 0.5, 0.0, 1.0) * scale;
  return clamp(
    v + shadows * shadow_weight + midtones * mid_weight_low * mid_weight_high * scale + highlights * highlight_weight,
    0.0,
    1.0,
  );
}

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let color = textureSample(src, samp, uv).rgb;
  let lightness = max(max(color.r, color.g), color.b) + min(min(color.r, color.g), color.b);
  var toned = color;
  toned.r = colorbalance_component(color.r, lightness, params.shadowR, params.midR, params.highlightR);
  toned.b = colorbalance_component(color.b, lightness, params.shadowB, 0.0, params.highlightB);
  if (params.protectNeutrals > 0.5) {
    toned = mix(color, toned, params.amount);
  }
  return vec4f(toned, 1.0);
}

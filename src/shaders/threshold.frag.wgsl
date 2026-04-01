@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct ThresholdParams {
  low: f32,
  high: f32,
  _pad1: f32,
  _pad2: f32,
};
@group(0) @binding(2) var<uniform> params: ThresholdParams;

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let c = textureSample(src, samp, uv).rgb;
  let luma = max(max(c.r, c.g), c.b);
  let t = smoothstep(params.low, params.high, luma);
  return vec4f(c * t, 1.0);
}

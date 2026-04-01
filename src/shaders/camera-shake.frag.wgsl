@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct ShakeParams {
  amplitude: f32,
  period1: f32,
  period2: f32,
  frame: f32,
};
@group(0) @binding(2) var<uniform> params: ShakeParams;

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let dx = params.amplitude * sin(params.frame / params.period1);
  let dy = params.amplitude * sin(params.frame / params.period2 + 1.3);
  let shifted = uv + vec2f(dx, dy);
  return textureSample(src, samp, clamp(shifted, vec2f(0.0), vec2f(1.0)));
}

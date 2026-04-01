@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct AberrationParams {
  offset: f32,
  _pad1: f32,
  _pad2: f32,
  _pad3: f32,
};
@group(0) @binding(2) var<uniform> params: AberrationParams;

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let center = vec2f(0.5);
  let dir = uv - center;
  let uv_r = center + dir * (1.0 + params.offset);
  let uv_b = center + dir * (1.0 - params.offset);
  let r = textureSample(src, samp, uv_r).r;
  let g = textureSample(src, samp, uv).g;
  let b = textureSample(src, samp, uv_b).b;
  return vec4f(r, g, b, 1.0);
}

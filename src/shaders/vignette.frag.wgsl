@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct VignetteParams {
  angle: f32,
  aspect: f32,
  _pad1: f32,
  _pad2: f32,
};
@group(0) @binding(2) var<uniform> params: VignetteParams;

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let color = textureSample(src, samp, uv).rgb;
  let center = uv - 0.5;
  let adjusted = vec2f(center.x, center.y * params.aspect);
  let dist = length(adjusted) * 2.0;
  let vig = cos(min(dist * params.angle, 3.14159265 * 0.5));
  return vec4f(color * vig * vig, 1.0);
}

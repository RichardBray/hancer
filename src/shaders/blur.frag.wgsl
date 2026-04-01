@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct BlurParams {
  direction: vec2f,
  sigma: f32,
  _pad: f32,
};
@group(0) @binding(2) var<uniform> params: BlurParams;

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let sigma = max(params.sigma, 0.001);
  let radius = i32(ceil(sigma * 3.0));
  var color = vec3f(0.0);
  var weight_sum = 0.0;

  for (var i = -radius; i <= radius; i = i + 1) {
    let offset = params.direction * f32(i);
    let w = exp(-f32(i * i) / (2.0 * sigma * sigma));
    color += textureSample(src, samp, uv + offset).rgb * w;
    weight_sum += w;
  }

  return vec4f(color / weight_sum, 1.0);
}

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct GrainParams {
  amount: f32,
  size: f32,
  softness: f32,
  saturation: f32,
  imageDefocus: f32,
  time: f32,
  texelSize: vec2f,
};
@group(0) @binding(2) var<uniform> params: GrainParams;

fn hash(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn grain_noise(uv: vec2f, t: f32) -> vec3f {
  let scale = max(1.0, params.size * 2.0 + 1.0);
  let coord = floor(uv * scale) + t;
  let r = hash(coord + vec2f(0.0, 0.0)) * 2.0 - 1.0;
  let g = hash(coord + vec2f(1.7, 3.1)) * 2.0 - 1.0;
  let b = hash(coord + vec2f(5.3, 2.9)) * 2.0 - 1.0;
  let mono = (r + g + b) / 3.0;
  return mix(vec3f(mono), vec3f(r, g, b), params.saturation);
}

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  var color = vec3f(0.0);
  if (params.imageDefocus > 0.0) {
    let r = params.imageDefocus * 0.5;
    var total = 0.0;
    for (var x = -1; x <= 1; x++) {
      for (var y = -1; y <= 1; y++) {
        let off = vec2f(f32(x), f32(y)) * params.texelSize * r;
        color += textureSample(src, samp, uv + off).rgb;
        total += 1.0;
      }
    }
    color /= total;
  } else {
    color = textureSample(src, samp, uv).rgb;
  }
  let dims = vec2f(textureDimensions(src));
  let n = grain_noise(uv * dims, params.time);
  let overlay = select(
    2.0 * color * (0.5 + n * 0.5),
    1.0 - 2.0 * (1.0 - color) * (0.5 - n * 0.5),
    color > vec3f(0.5)
  );
  return vec4f(mix(color, overlay, params.amount), 1.0);
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VertexOutput {
  // Fullscreen triangle trick: 3 vertices, no vertex buffer
  let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var out: VertexOutput;
  out.position = vec4f(uv * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(uv.x, 1.0 - uv.y); // flip Y for texture coords
  return out;
}

use wgpu::*;

pub fn create_standard_bind_group_layout(device: &Device) -> BindGroupLayout {
    device.create_bind_group_layout(&BindGroupLayoutDescriptor {
        label: Some("standard_layout"),
        entries: &[
            BindGroupLayoutEntry {
                binding: 0,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Texture {
                    sample_type: TextureSampleType::Float { filterable: true },
                    view_dimension: TextureViewDimension::D2,
                    multisampled: false,
                },
                count: None,
            },
            BindGroupLayoutEntry {
                binding: 1,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Sampler(SamplerBindingType::Filtering),
                count: None,
            },
            BindGroupLayoutEntry {
                binding: 2,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Buffer {
                    ty: BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            },
        ],
    })
}

pub fn create_blend_bind_group_layout(device: &Device) -> BindGroupLayout {
    device.create_bind_group_layout(&BindGroupLayoutDescriptor {
        label: Some("blend_layout"),
        entries: &[
            BindGroupLayoutEntry {
                binding: 0,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Texture {
                    sample_type: TextureSampleType::Float { filterable: true },
                    view_dimension: TextureViewDimension::D2,
                    multisampled: false,
                },
                count: None,
            },
            BindGroupLayoutEntry {
                binding: 1,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Sampler(SamplerBindingType::Filtering),
                count: None,
            },
            BindGroupLayoutEntry {
                binding: 2,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Texture {
                    sample_type: TextureSampleType::Float { filterable: true },
                    view_dimension: TextureViewDimension::D2,
                    multisampled: false,
                },
                count: None,
            },
            BindGroupLayoutEntry {
                binding: 3,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Buffer {
                    ty: BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            },
        ],
    })
}

pub fn create_pipeline(
    device: &Device,
    vertex_shader: &str,
    fragment_shader: &str,
    layout: &BindGroupLayout,
    format: TextureFormat,
) -> RenderPipeline {
    let vs_module = device.create_shader_module(ShaderModuleDescriptor {
        label: Some("vertex"),
        source: ShaderSource::Wgsl(vertex_shader.into()),
    });
    let fs_module = device.create_shader_module(ShaderModuleDescriptor {
        label: Some("fragment"),
        source: ShaderSource::Wgsl(fragment_shader.into()),
    });
    let pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
        label: None,
        bind_group_layouts: &[layout],
        push_constant_ranges: &[],
    });
    device.create_render_pipeline(&RenderPipelineDescriptor {
        label: None,
        layout: Some(&pipeline_layout),
        vertex: VertexState {
            module: &vs_module,
            entry_point: Some("vs"),
            buffers: &[],
            compilation_options: Default::default(),
        },
        fragment: Some(FragmentState {
            module: &fs_module,
            entry_point: Some("fs"),
            targets: &[Some(ColorTargetState {
                format,
                blend: None,
                write_mask: ColorWrites::ALL,
            })],
            compilation_options: Default::default(),
        }),
        primitive: PrimitiveState {
            topology: PrimitiveTopology::TriangleList,
            ..Default::default()
        },
        depth_stencil: None,
        multisample: Default::default(),
        multiview: None,
        cache: None,
    })
}

pub fn create_texture(device: &Device, width: u32, height: u32, format: TextureFormat) -> Texture {
    device.create_texture(&TextureDescriptor {
        label: None,
        size: Extent3d { width, height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: TextureDimension::D2,
        format,
        usage: TextureUsages::TEXTURE_BINDING
            | TextureUsages::RENDER_ATTACHMENT
            | TextureUsages::COPY_DST
            | TextureUsages::COPY_SRC,
        view_formats: &[],
    })
}

pub fn create_uniform_buffer(device: &Device, size: u64) -> Buffer {
    let aligned = ((size + 15) / 16) * 16;
    device.create_buffer(&BufferDescriptor {
        label: None,
        size: aligned,
        usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
        mapped_at_creation: false,
    })
}

pub fn make_std_bind_group(
    device: &Device,
    layout: &BindGroupLayout,
    texture: &TextureView,
    sampler: &Sampler,
    uniform: &Buffer,
) -> BindGroup {
    device.create_bind_group(&BindGroupDescriptor {
        label: None,
        layout,
        entries: &[
            BindGroupEntry { binding: 0, resource: BindingResource::TextureView(texture) },
            BindGroupEntry { binding: 1, resource: BindingResource::Sampler(sampler) },
            BindGroupEntry { binding: 2, resource: uniform.as_entire_binding() },
        ],
    })
}

pub fn make_blend_bind_group(
    device: &Device,
    layout: &BindGroupLayout,
    base: &TextureView,
    sampler: &Sampler,
    overlay: &TextureView,
    uniform: &Buffer,
) -> BindGroup {
    device.create_bind_group(&BindGroupDescriptor {
        label: None,
        layout,
        entries: &[
            BindGroupEntry { binding: 0, resource: BindingResource::TextureView(base) },
            BindGroupEntry { binding: 1, resource: BindingResource::Sampler(sampler) },
            BindGroupEntry { binding: 2, resource: BindingResource::TextureView(overlay) },
            BindGroupEntry { binding: 3, resource: uniform.as_entire_binding() },
        ],
    })
}

pub fn run_pass(
    encoder: &mut CommandEncoder,
    pipeline: &RenderPipeline,
    bind_group: &BindGroup,
    target: &TextureView,
) {
    let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
        label: None,
        color_attachments: &[Some(RenderPassColorAttachment {
            view: target,
            resolve_target: None,
            ops: Operations {
                load: LoadOp::Clear(Color { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }),
                store: StoreOp::Store,
            },
        })],
        depth_stencil_attachment: None,
        timestamp_writes: None,
        occlusion_query_set: None,
    });
    pass.set_pipeline(pipeline);
    pass.set_bind_group(0, bind_group, &[]);
    pass.draw(0..3, 0..1);
}

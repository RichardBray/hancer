use std::collections::HashMap;
use wgpu::*;

use crate::params::Params;
use crate::passes;

const VERT: &str = include_str!("../../core/shaders/fullscreen.vert.wgsl");
const COLOR_FRAG: &str = include_str!("../../core/shaders/color-settings.frag.wgsl");
const THRESHOLD_FRAG: &str = include_str!("../../core/shaders/threshold.frag.wgsl");
const BLUR_FRAG: &str = include_str!("../../core/shaders/blur.frag.wgsl");
const BLEND_FRAG: &str = include_str!("../../core/shaders/screen-blend.frag.wgsl");
const ABERRATION_FRAG: &str = include_str!("../../core/shaders/aberration.frag.wgsl");
const GRAIN_FRAG: &str = include_str!("../../core/shaders/grain.frag.wgsl");
const VIGNETTE_FRAG: &str = include_str!("../../core/shaders/vignette.frag.wgsl");
const SPLIT_TONE_FRAG: &str = include_str!("../../core/shaders/split-tone.frag.wgsl");
const SHAKE_FRAG: &str = include_str!("../../core/shaders/camera-shake.frag.wgsl");

const FORMAT: TextureFormat = TextureFormat::Rgba8Unorm;

pub struct GpuRenderer {
    device: Device,
    queue: Queue,
    width: u32,
    height: u32,
    params: Params,
    frame_count: u32,

    // Textures
    src_tex: Texture,
    tex_a: Texture,
    tex_b: Texture,
    half_a: Texture,
    half_b: Texture,

    // Layouts
    std_layout: BindGroupLayout,
    blend_layout: BindGroupLayout,
    sampler: Sampler,

    // Pipelines
    color_pipeline: RenderPipeline,
    threshold_pipeline: RenderPipeline,
    blur_pipeline: RenderPipeline,
    blend_pipeline: RenderPipeline,
    aberration_pipeline: RenderPipeline,
    grain_pipeline: RenderPipeline,
    vignette_pipeline: RenderPipeline,
    split_tone_pipeline: RenderPipeline,
    shake_pipeline: RenderPipeline,

    // Uniform buffers
    color_ub: Buffer,
    threshold_ub: Buffer,
    blur_ub1: Buffer,
    blur_ub2: Buffer,
    blend_ub: Buffer,
    aberration_ub: Buffer,
    grain_ub: Buffer,
    vignette_ub: Buffer,
    split_tone_ub: Buffer,
    shake_ub: Buffer,
    bloom_blur_ub1: Buffer,
    bloom_blur_ub2: Buffer,
    bloom_blend_ub: Buffer,

    // Readback
    staging_buf: Buffer,
}

impl GpuRenderer {
    pub fn new(width: u32, height: u32, raw_params: &HashMap<String, serde_json::Value>) -> Result<Self, String> {
        let instance = Instance::new(&InstanceDescriptor {
            backends: Backends::all(),
            ..Default::default()
        });

        let adapter = pollster::block_on(instance.request_adapter(&RequestAdapterOptions {
            power_preference: PowerPreference::HighPerformance,
            ..Default::default()
        }))
        .ok_or("No GPU adapter found")?;

        let (device, queue) = pollster::block_on(adapter.request_device(&DeviceDescriptor {
            label: Some("hance-gpu"),
            ..Default::default()
        }, None))
        .map_err(|e| format!("Device request failed: {e}"))?;

        let sampler = device.create_sampler(&SamplerDescriptor {
            mag_filter: FilterMode::Linear,
            min_filter: FilterMode::Linear,
            ..Default::default()
        });

        let std_layout = passes::create_standard_bind_group_layout(&device);
        let blend_layout = passes::create_blend_bind_group_layout(&device);

        let half_w = (width / 2).max(1);
        let half_h = (height / 2).max(1);

        let src_tex = device.create_texture(&TextureDescriptor {
            label: Some("src"),
            size: Extent3d { width, height, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format: TextureFormat::Rgba8Unorm,
            usage: TextureUsages::TEXTURE_BINDING | TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let tex_a = passes::create_texture(&device, width, height, FORMAT);
        let tex_b = passes::create_texture(&device, width, height, FORMAT);
        let half_a = passes::create_texture(&device, half_w, half_h, FORMAT);
        let half_b = passes::create_texture(&device, half_w, half_h, FORMAT);

        let color_pipeline = passes::create_pipeline(&device, VERT, COLOR_FRAG, &std_layout, FORMAT);
        let threshold_pipeline = passes::create_pipeline(&device, VERT, THRESHOLD_FRAG, &std_layout, FORMAT);
        let blur_pipeline = passes::create_pipeline(&device, VERT, BLUR_FRAG, &std_layout, FORMAT);
        let blend_pipeline = passes::create_pipeline(&device, VERT, BLEND_FRAG, &blend_layout, FORMAT);
        let aberration_pipeline = passes::create_pipeline(&device, VERT, ABERRATION_FRAG, &std_layout, FORMAT);
        let grain_pipeline = passes::create_pipeline(&device, VERT, GRAIN_FRAG, &std_layout, FORMAT);
        let vignette_pipeline = passes::create_pipeline(&device, VERT, VIGNETTE_FRAG, &std_layout, FORMAT);
        let split_tone_pipeline = passes::create_pipeline(&device, VERT, SPLIT_TONE_FRAG, &std_layout, FORMAT);
        let shake_pipeline = passes::create_pipeline(&device, VERT, SHAKE_FRAG, &std_layout, FORMAT);

        let color_ub = passes::create_uniform_buffer(&device, 32);
        let threshold_ub = passes::create_uniform_buffer(&device, 16);
        let blur_ub1 = passes::create_uniform_buffer(&device, 16);
        let blur_ub2 = passes::create_uniform_buffer(&device, 16);
        let blend_ub = passes::create_uniform_buffer(&device, 16);
        let aberration_ub = passes::create_uniform_buffer(&device, 16);
        let grain_ub = passes::create_uniform_buffer(&device, 32);
        let vignette_ub = passes::create_uniform_buffer(&device, 16);
        let split_tone_ub = passes::create_uniform_buffer(&device, 32);
        let shake_ub = passes::create_uniform_buffer(&device, 16);
        let bloom_blur_ub1 = passes::create_uniform_buffer(&device, 16);
        let bloom_blur_ub2 = passes::create_uniform_buffer(&device, 16);
        let bloom_blend_ub = passes::create_uniform_buffer(&device, 16);

        let bytes_per_row = ((width * 4 + 255) / 256) * 256;
        let staging_buf = device.create_buffer(&BufferDescriptor {
            label: Some("staging"),
            size: (bytes_per_row * height) as u64,
            usage: BufferUsages::COPY_DST | BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        Ok(Self {
            device,
            queue,
            width,
            height,
            params: Params::new(raw_params.clone()),
            frame_count: 0,
            src_tex,
            tex_a,
            tex_b,
            half_a,
            half_b,
            std_layout,
            blend_layout,
            sampler,
            color_pipeline,
            threshold_pipeline,
            blur_pipeline,
            blend_pipeline,
            aberration_pipeline,
            grain_pipeline,
            vignette_pipeline,
            split_tone_pipeline,
            shake_pipeline,
            color_ub,
            threshold_ub,
            blur_ub1,
            blur_ub2,
            blend_ub,
            aberration_ub,
            grain_ub,
            vignette_ub,
            split_tone_ub,
            shake_ub,
            bloom_blur_ub1,
            bloom_blur_ub2,
            bloom_blend_ub,
            staging_buf,
        })
    }

    fn write_uniform(&self, buffer: &Buffer, data: &[f32]) {
        self.queue.write_buffer(buffer, 0, bytemuck_cast(data));
    }

    pub fn render_frame(&mut self, input: &[u8]) -> Vec<u8> {
        self.frame_count += 1;

        // Upload source
        self.queue.write_texture(
            TexelCopyTextureInfo {
                texture: &self.src_tex,
                mip_level: 0,
                origin: Origin3d::ZERO,
                aspect: TextureAspect::All,
            },
            input,
            TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(self.width * 4),
                rows_per_image: Some(self.height),
            },
            Extent3d { width: self.width, height: self.height, depth_or_array_layers: 1 },
        );

        let mut encoder = self.device.create_command_encoder(&CommandEncoderDescriptor { label: None });

        let mut current_is_b = false;

        macro_rules! current_tex { () => { if current_is_b { &self.tex_b } else { &self.tex_a } } }
        macro_rules! other_tex { () => { if current_is_b { &self.tex_a } else { &self.tex_b } } }
        macro_rules! swap { () => { current_is_b = !current_is_b; } }

        let half_w = (self.width / 2).max(1);
        let half_h = (self.height / 2).max(1);

        // --- Color Settings ---
        if !self.params.bool("no-color-settings", false) {
            self.write_uniform(&self.color_ub, &self.params.color_settings_uniform());
        } else {
            self.write_uniform(&self.color_ub, &Params::color_settings_identity());
        }
        let bg = passes::make_std_bind_group(
            &self.device, &self.std_layout,
            &self.src_tex.create_view(&TextureViewDescriptor::default()),
            &self.sampler, &self.color_ub,
        );
        passes::run_pass(&mut encoder, &self.color_pipeline, &bg,
            &current_tex!().create_view(&TextureViewDescriptor::default()));

        // --- Halation ---
        if self.params.halation_enabled() {
            let amount = self.params.halation_amount();
            let radius = self.params.halation_radius();
            let sigma = radius * 0.5;

            if self.params.halation_highlights_only() {
                self.write_uniform(&self.threshold_ub, &[0.65, 0.75, 0.0, 0.0]);
                let bg = passes::make_std_bind_group(
                    &self.device, &self.std_layout,
                    &current_tex!().create_view(&TextureViewDescriptor::default()),
                    &self.sampler, &self.threshold_ub,
                );
                passes::run_pass(&mut encoder, &self.threshold_pipeline, &bg,
                    &self.half_a.create_view(&TextureViewDescriptor::default()));
            } else {
                self.write_uniform(&self.blur_ub1, &[0.0, 0.0, 0.001, 0.0]);
                let bg = passes::make_std_bind_group(
                    &self.device, &self.std_layout,
                    &current_tex!().create_view(&TextureViewDescriptor::default()),
                    &self.sampler, &self.blur_ub1,
                );
                passes::run_pass(&mut encoder, &self.blur_pipeline, &bg,
                    &self.half_a.create_view(&TextureViewDescriptor::default()));
            }

            self.write_uniform(&self.blur_ub1, &[1.0 / half_w as f32, 0.0, sigma, 0.0]);
            let h_bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &self.half_a.create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.blur_ub1,
            );
            passes::run_pass(&mut encoder, &self.blur_pipeline, &h_bg,
                &self.half_b.create_view(&TextureViewDescriptor::default()));

            self.write_uniform(&self.blur_ub2, &[0.0, 1.0 / half_h as f32, sigma, 0.0]);
            let v_bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &self.half_b.create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.blur_ub2,
            );
            passes::run_pass(&mut encoder, &self.blur_pipeline, &v_bg,
                &self.half_a.create_view(&TextureViewDescriptor::default()));

            let hue = self.params.halation_hue();
            let sat = self.params.halation_saturation();
            self.write_uniform(&self.blend_ub, &[amount, hue, sat, 0.0]);
            let blend_bg = passes::make_blend_bind_group(
                &self.device, &self.blend_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler,
                &self.half_a.create_view(&TextureViewDescriptor::default()),
                &self.blend_ub,
            );
            passes::run_pass(&mut encoder, &self.blend_pipeline, &blend_bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Chromatic Aberration ---
        if self.params.aberration_enabled() {
            let offset = self.params.aberration_offset();
            self.write_uniform(&self.aberration_ub, &[offset, 0.0, 0.0, 0.0]);
            let bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.aberration_ub,
            );
            passes::run_pass(&mut encoder, &self.aberration_pipeline, &bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Bloom ---
        if self.params.bloom_enabled() {
            let amount = self.params.bloom_amount();
            let radius = self.params.bloom_radius();
            let sigma = radius * 0.5;

            self.write_uniform(&self.blur_ub1, &[0.0, 0.0, 0.001, 0.0]);
            let ds_bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.blur_ub1,
            );
            passes::run_pass(&mut encoder, &self.blur_pipeline, &ds_bg,
                &self.half_a.create_view(&TextureViewDescriptor::default()));

            self.write_uniform(&self.bloom_blur_ub1, &[1.0 / half_w as f32, 0.0, sigma, 0.0]);
            let h_bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &self.half_a.create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.bloom_blur_ub1,
            );
            passes::run_pass(&mut encoder, &self.blur_pipeline, &h_bg,
                &self.half_b.create_view(&TextureViewDescriptor::default()));

            self.write_uniform(&self.bloom_blur_ub2, &[0.0, 1.0 / half_h as f32, sigma, 0.0]);
            let v_bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &self.half_b.create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.bloom_blur_ub2,
            );
            passes::run_pass(&mut encoder, &self.blur_pipeline, &v_bg,
                &self.half_a.create_view(&TextureViewDescriptor::default()));

            self.write_uniform(&self.bloom_blend_ub, &[amount, 0.0, 1.0, 0.0]);
            let blend_bg = passes::make_blend_bind_group(
                &self.device, &self.blend_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler,
                &self.half_a.create_view(&TextureViewDescriptor::default()),
                &self.bloom_blend_ub,
            );
            passes::run_pass(&mut encoder, &self.blend_pipeline, &blend_bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Grain ---
        if self.params.grain_enabled() {
            self.write_uniform(&self.grain_ub, &self.params.grain_uniform(self.frame_count, self.width, self.height));
            let bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.grain_ub,
            );
            passes::run_pass(&mut encoder, &self.grain_pipeline, &bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Vignette ---
        if self.params.vignette_enabled() {
            self.write_uniform(&self.vignette_ub, &self.params.vignette_uniform());
            let bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.vignette_ub,
            );
            passes::run_pass(&mut encoder, &self.vignette_pipeline, &bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Split Tone ---
        if self.params.split_tone_enabled() {
            self.write_uniform(&self.split_tone_ub, &self.params.split_tone_uniform());
            let bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.split_tone_ub,
            );
            passes::run_pass(&mut encoder, &self.split_tone_pipeline, &bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Camera Shake ---
        if self.params.camera_shake_enabled() {
            self.write_uniform(&self.shake_ub, &self.params.camera_shake_uniform(self.frame_count, self.width));
            let bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.shake_ub,
            );
            passes::run_pass(&mut encoder, &self.shake_pipeline, &bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Readback ---
        let bytes_per_row = ((self.width * 4 + 255) / 256) * 256;
        encoder.copy_texture_to_buffer(
            TexelCopyTextureInfo {
                texture: current_tex!(),
                mip_level: 0,
                origin: Origin3d::ZERO,
                aspect: TextureAspect::All,
            },
            TexelCopyBufferInfo {
                buffer: &self.staging_buf,
                layout: TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(bytes_per_row),
                    rows_per_image: Some(self.height),
                },
            },
            Extent3d { width: self.width, height: self.height, depth_or_array_layers: 1 },
        );

        self.queue.submit(std::iter::once(encoder.finish()));

        let slice = self.staging_buf.slice(..);
        slice.map_async(MapMode::Read, |_| {});
        self.device.poll(Maintain::Wait);

        let mapped = slice.get_mapped_range();
        let mut result = vec![0u8; (self.width * self.height * 4) as usize];
        for y in 0..self.height {
            let src_offset = (y * bytes_per_row) as usize;
            let dst_offset = (y * self.width * 4) as usize;
            let row_bytes = (self.width * 4) as usize;
            result[dst_offset..dst_offset + row_bytes]
                .copy_from_slice(&mapped[src_offset..src_offset + row_bytes]);
        }
        drop(mapped);
        self.staging_buf.unmap();

        result
    }
}

/// Cast &[f32] to &[u8] for uniform buffer writes
fn bytemuck_cast(data: &[f32]) -> &[u8] {
    unsafe { std::slice::from_raw_parts(data.as_ptr() as *const u8, data.len() * 4) }
}

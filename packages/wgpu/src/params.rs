use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct InitMessage {
    pub width: u32,
    pub height: u32,
    pub params: HashMap<String, serde_json::Value>,
}

pub struct Params {
    map: HashMap<String, serde_json::Value>,
}

impl Params {
    pub fn new(map: HashMap<String, serde_json::Value>) -> Self {
        Self { map }
    }

    pub fn num(&self, key: &str, fallback: f32) -> f32 {
        self.map
            .get(key)
            .and_then(|v| v.as_f64())
            .map(|v| v as f32)
            .unwrap_or(fallback)
    }

    pub fn bool(&self, key: &str, fallback: bool) -> bool {
        self.map
            .get(key)
            .and_then(|v| v.as_bool())
            .unwrap_or(fallback)
    }

    pub fn str(&self, key: &str, fallback: &str) -> String {
        self.map
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| fallback.to_string())
    }

    /// Color settings uniform: [contrast, brightness, saturation, gamma, whiteBalance, tint, bleachBypass, 0]
    pub fn color_settings_uniform(&self) -> [f32; 8] {
        let fade = self.num("fade", 0.0);
        let contrast = self.num("contrast", 1.0) * (1.0 - fade);
        let brightness = self.num("exposure", 0.0) * 0.1 + fade * 0.05;
        let saturation = self.num("subtractive-sat", 1.0) * self.num("richness", 1.0);
        let gamma = 1.0 - self.num("highlights", 0.0) * 0.5;
        let wb = self.num("white-balance", 6500.0);
        let tint = self.num("tint", 0.0) / 100.0;
        let bleach = self.num("bleach-bypass", 0.0);
        [contrast, brightness, saturation, gamma, wb, tint, bleach, 0.0]
    }

    /// Identity color settings (passthrough)
    pub fn color_settings_identity() -> [f32; 8] {
        [1.0, 0.0, 1.0, 1.0, 6500.0, 0.0, 0.0, 0.0]
    }

    pub fn halation_enabled(&self) -> bool {
        !self.bool("no-halation", false) && self.num("halation-amount", 0.25) > 0.0
    }

    pub fn halation_amount(&self) -> f32 {
        self.num("halation-amount", 0.25)
    }

    pub fn halation_radius(&self) -> f32 {
        self.num("halation-radius", 4.0)
    }

    pub fn halation_highlights_only(&self) -> bool {
        self.bool("halation-highlights-only", true)
    }

    pub fn halation_hue(&self) -> f32 {
        self.num("halation-hue", 0.5) * 360.0
    }

    pub fn halation_saturation(&self) -> f32 {
        self.num("halation-saturation", 1.0)
    }

    pub fn aberration_enabled(&self) -> bool {
        !self.bool("no-aberration", false) && self.num("aberration", 0.3) > 0.0
    }

    pub fn aberration_offset(&self) -> f32 {
        self.num("aberration", 0.3) * 0.02
    }

    pub fn bloom_enabled(&self) -> bool {
        !self.bool("no-bloom", false) && self.num("bloom-amount", 0.25) > 0.0
    }

    pub fn bloom_amount(&self) -> f32 {
        self.num("bloom-amount", 0.25)
    }

    pub fn bloom_radius(&self) -> f32 {
        self.num("bloom-radius", 10.0)
    }

    pub fn grain_enabled(&self) -> bool {
        !self.bool("no-grain", false) && self.num("grain-amount", 0.125) > 0.0
    }

    /// Grain uniform: [amount, size, softness, saturation, defocus, time, texelW, texelH]
    pub fn grain_uniform(&self, frame_count: u32, width: u32, height: u32) -> [f32; 8] {
        [
            self.num("grain-amount", 0.125),
            self.num("grain-size", 0.0),
            self.num("grain-softness", 0.1),
            self.num("grain-saturation", 0.3),
            self.num("grain-defocus", 1.0),
            frame_count as f32,
            1.0 / width as f32,
            1.0 / height as f32,
        ]
    }

    pub fn vignette_enabled(&self) -> bool {
        !self.bool("no-vignette", false) && self.num("vignette-amount", 0.25) > 0.0
    }

    /// Vignette uniform: [angle, aspect, 0, 0]
    pub fn vignette_uniform(&self) -> [f32; 4] {
        let amount = self.num("vignette-amount", 0.25);
        let angle = amount * std::f32::consts::FRAC_PI_2;
        let aspect = 1.0 - self.num("vignette-size", 0.25) * 0.5;
        [angle, aspect, 0.0, 0.0]
    }

    pub fn split_tone_enabled(&self) -> bool {
        !self.bool("no-split-tone", false) && self.num("split-tone-amount", 0.0) > 0.0
    }

    /// Split tone uniform: [shadowR, shadowB, highlightR, highlightB, midR, amount, protect, 0]
    pub fn split_tone_uniform(&self) -> [f32; 8] {
        let amount = self.num("split-tone-amount", 0.0);
        let hue = self.num("split-tone-hue", 20.0);
        let pivot = self.num("split-tone-pivot", 0.3);
        let mode = self.str("split-tone-mode", "natural");
        let protect = if self.bool("split-tone-protect-neutrals", false) { 1.0 } else { 0.0 };

        let hue_rad = hue.to_radians();
        let cos_hue = hue_rad.cos();
        let sin_hue = hue_rad.sin();
        let shadow_r = cos_hue * amount * 0.3;
        let shadow_b = sin_hue * amount * 0.3;

        let highlight_scale = if mode == "complementary" { 0.3 } else { 0.15 };
        let (cos_hl, sin_hl) = if mode == "complementary" {
            (-cos_hue, -sin_hue)
        } else {
            (cos_hue, sin_hue)
        };
        let highlight_r = cos_hl * amount * highlight_scale;
        let highlight_b = sin_hl * amount * highlight_scale;
        let mid_r = pivot * -0.1;

        [shadow_r, shadow_b, highlight_r, highlight_b, mid_r, amount, protect, 0.0]
    }

    pub fn camera_shake_enabled(&self) -> bool {
        !self.bool("no-camera-shake", false) && self.num("camera-shake-amount", 0.25) > 0.0
    }

    /// Camera shake uniform: [amplitude, period1, period2, frame]
    pub fn camera_shake_uniform(&self, frame_count: u32, width: u32) -> [f32; 4] {
        let amount = self.num("camera-shake-amount", 0.25);
        let rate = self.num("camera-shake-rate", 0.5);
        let amplitude = (amount * 3.0) / width as f32;
        let period1 = (30.0 / (rate + 0.01)).max(1.0);
        let period2 = period1 * 1.3;
        [amplitude, period1, period2, frame_count as f32]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_params(pairs: &[(&str, serde_json::Value)]) -> Params {
        let map: HashMap<String, serde_json::Value> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect();
        Params::new(map)
    }

    #[test]
    fn color_settings_defaults() {
        let p = make_params(&[]);
        let u = p.color_settings_uniform();
        assert_eq!(u[0], 1.0);
        assert_eq!(u[1], 0.0);
        assert_eq!(u[2], 1.0);
        assert_eq!(u[3], 1.0);
        assert_eq!(u[4], 6500.0);
    }

    #[test]
    fn color_settings_with_fade() {
        let p = make_params(&[("fade", serde_json::json!(0.5))]);
        let u = p.color_settings_uniform();
        assert!((u[0] - 0.5).abs() < 0.001);
        assert!((u[1] - 0.025).abs() < 0.001);
    }

    #[test]
    fn split_tone_natural_mode() {
        let p = make_params(&[
            ("split-tone-amount", serde_json::json!(1.0)),
            ("split-tone-hue", serde_json::json!(0.0)),
            ("split-tone-pivot", serde_json::json!(0.3)),
        ]);
        let u = p.split_tone_uniform();
        assert!((u[0] - 0.3).abs() < 0.001);
        assert!((u[1] - 0.0).abs() < 0.001);
        assert!((u[2] - 0.15).abs() < 0.001);
    }

    #[test]
    fn split_tone_complementary_mode() {
        let p = make_params(&[
            ("split-tone-amount", serde_json::json!(1.0)),
            ("split-tone-hue", serde_json::json!(0.0)),
            ("split-tone-mode", serde_json::json!("complementary")),
            ("split-tone-pivot", serde_json::json!(0.3)),
        ]);
        let u = p.split_tone_uniform();
        assert!((u[2] - (-0.3)).abs() < 0.001);
    }

    #[test]
    fn camera_shake_uniform_values() {
        let p = make_params(&[
            ("camera-shake-amount", serde_json::json!(1.0)),
            ("camera-shake-rate", serde_json::json!(0.5)),
        ]);
        let u = p.camera_shake_uniform(10, 1920);
        let expected_amplitude = 3.0 / 1920.0;
        assert!((u[0] - expected_amplitude).abs() < 0.0001);
        let expected_period1 = 30.0 / 0.51;
        assert!((u[1] - expected_period1).abs() < 0.1);
        assert_eq!(u[3], 10.0);
    }

    #[test]
    fn init_message_deserialize() {
        let json = r#"{"width":1920,"height":1080,"params":{"contrast":1.2}}"#;
        let msg: InitMessage = serde_json::from_str(json).unwrap();
        assert_eq!(msg.width, 1920);
        assert_eq!(msg.height, 1080);
        assert_eq!(msg.params.get("contrast").unwrap().as_f64().unwrap(), 1.2);
    }
}

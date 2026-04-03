mod params;
mod passes;
mod renderer;

use std::io::{self, Read, Write};

fn read_init_message(stdin: &mut impl Read) -> io::Result<params::InitMessage> {
    let mut len_buf = [0u8; 4];
    stdin.read_exact(&mut len_buf)?;
    let len = u32::from_le_bytes(len_buf) as usize;

    let mut json_buf = vec![0u8; len];
    stdin.read_exact(&mut json_buf)?;

    serde_json::from_slice(&json_buf)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

fn main() {
    let mut stdin = io::stdin().lock();
    let mut stdout = io::stdout().lock();

    let init = match read_init_message(&mut stdin) {
        Ok(msg) => msg,
        Err(e) => {
            eprintln!("Failed to read init message: {e}");
            std::process::exit(1);
        }
    };

    let mut gpu = match renderer::GpuRenderer::new(init.width, init.height, &init.params) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("GPU init failed: {e}");
            std::process::exit(1);
        }
    };

    let frame_size = (init.width * init.height * 4) as usize;
    let mut frame_buf = vec![0u8; frame_size];

    loop {
        match stdin.read_exact(&mut frame_buf) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => break,
            Err(e) => {
                eprintln!("stdin read error: {e}");
                std::process::exit(1);
            }
        }

        let rendered = gpu.render_frame(&frame_buf);

        if let Err(e) = stdout.write_all(&rendered) {
            eprintln!("stdout write error: {e}");
            std::process::exit(1);
        }
        stdout.flush().unwrap();
    }
}

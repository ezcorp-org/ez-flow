fn main() {
    // Rebuild if tray icons change
    println!("cargo:rerun-if-changed=icons/32x32.png");
    println!("cargo:rerun-if-changed=icons/32x32-recording.png");
    tauri_build::build()
}

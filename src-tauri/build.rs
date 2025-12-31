fn main() {
    // Rebuild if tray icon changes
    println!("cargo:rerun-if-changed=icons/32x32.png");
    tauri_build::build()
}

fn main() {
  // tauri_build copies externalBin/resources into target/ but only re-runs on
  // tauri.conf.json changes: adding a platform file or a new sidecar left
  // qpdf/img2pdf missing from target/debug after a merge.
  for f in ["tauri.windows.conf.json", "tauri.linux.conf.json", "tauri.macos.conf.json", "binaries"] {
    println!("cargo:rerun-if-changed={f}");
  }
  tauri_build::build()
}

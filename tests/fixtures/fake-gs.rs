// Fake Ghostscript for tests/e2e/engines.test.mjs (compiled there with
// rustc to a temp `gswin64c.exe`). Writes its argv (one per line) to
// `args.txt` next to itself, then copies `gs-output.pdf` from next to itself
// to the `-sOutputFile=` path; exits 1 when that file is missing.
use std::{env, fs, process};

fn main() {
  let exe = env::current_exe().unwrap();
  let dir = exe.parent().unwrap();
  let args: Vec<String> = env::args().skip(1).collect();
  fs::write(dir.join("args.txt"), args.join("\n")).unwrap();
  let out = args.iter().find_map(|a| a.strip_prefix("-sOutputFile=")).expect("no -sOutputFile=");
  if let Err(e) = fs::copy(dir.join("gs-output.pdf"), out) {
    eprintln!("fake gs: gs-output.pdf: {e}");
    process::exit(1);
  }
}

// Fake yt-dlp for tests/e2e/engines.test.mjs (compiled there with rustc to
// a temp `yt-dlp.exe` and served as a "newer release"): prints a version
// newer than any real one, which is all the converter's install check runs.
fn main() {
  println!("2099.01.01");
}

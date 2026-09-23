// a macro rewrites tokens, written in Rust and used
// in the same file; prefix only, never `4 twice`
macro_rules! twice {
    ($e:expr) => { $e * 2 };
}

fn main() {
    println!("{}", 3 + twice!(4)); // 11
}

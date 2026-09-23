// the spot a line is written at is text, not a scope:
// its file and line; nothing walks up from it
fn main() {
    println!("{}:{}", file!(), line!()); // file, line
}

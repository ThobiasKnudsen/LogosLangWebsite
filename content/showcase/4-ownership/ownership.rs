// a Box owns its heap value and frees it when the
// owner goes out of scope; a move hands that duty on
fn main() {
    let a = Box::new(40);
    let b = a; // ownership moves to b; a is gone
    println!("{}", *b); // 40
}

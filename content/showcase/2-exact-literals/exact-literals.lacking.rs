// lacking: 0.1 is a float; no exact rational in std
// a literal is a float from the start; no exact
// rational in the language or its standard library
fn main() {
    println!("{}", 0.1 + 0.2 == 0.3); // false
}

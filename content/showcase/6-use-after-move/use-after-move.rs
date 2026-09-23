// a move ends the name; a later use is a compile
// error, nothing waits for run time
fn main() {
    let a = Box::new(40);
    let b = a;
    println!("{}", *b); // 40
    println!("{}", *a); // error[E0382]: moved value
}

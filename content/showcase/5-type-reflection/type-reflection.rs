// a value's type has an identity at run time,
// though nothing more of it can be read back
use std::any::{Any, TypeId};

fn main() {
    let x: i32 = 5;
    let same = x.type_id() == TypeId::of::<i32>();
    let cross = x.type_id() == TypeId::of::<f64>();
    println!("{}", same && !cross); // true
}

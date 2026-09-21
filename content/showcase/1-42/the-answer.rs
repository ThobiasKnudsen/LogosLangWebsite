// the answer, computed the long way
fn double(x: i32) -> i32 {
    x + x
}

fn main() {
    let mut sum = 0;
    for i in 0..7 {
        sum += i;
    }
    println!("{}", double(sum)); // 42
}

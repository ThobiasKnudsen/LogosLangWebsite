// lacking: `Point::DIMS` cannot be read through a value
// a struct holds the fields; an associated const is
// read through the type only, never through a value
struct Point { x: i32, y: i32 }
impl Point { const DIMS: i32 = 2; }

fn main() {
    let p = Point { x: 1, y: 2 };
    println!("{} {}", p.x + p.y, Point::DIMS); // 3 2
}

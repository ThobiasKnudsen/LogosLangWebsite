// @TypeOf reads a type at compile time; types compare
// with ==
const std = @import("std");

pub fn main() void {
    const x: i32 = 5;
    const same = @TypeOf(x) == i32; // true
    const cross = @TypeOf(x) == f64; // false
    const meta = @TypeOf(i32) == type; // true
    const all = same and meta and !cross;
    std.debug.print("{}\n", .{all});
}

// a function can return a type, run at compile time
const std = @import("std");

fn pick(i: u8) type {
    return if (i == 0) i32 else f64;
}

pub fn main() void {
    const a: pick(1) = 9.9; // a is an f64
    const same = pick(0) == i32;
    std.debug.print("{d} {}\n", .{ a, same });
}

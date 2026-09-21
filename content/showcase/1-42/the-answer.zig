// the answer, computed the long way
const std = @import("std");

fn double(x: i32) i32 {
    return x + x;
}

pub fn main() void {
    var sum: i32 = 0;
    var i: i32 = 0;
    while (i < 7) : (i += 1) sum += i;
    std.debug.print("{d}\n", .{double(sum)}); // 42
}

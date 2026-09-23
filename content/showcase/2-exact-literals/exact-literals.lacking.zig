// a literal is a float from the start, even at
// compile time, where it is an f128
const std = @import("std");

pub fn main() void {
    // false
    std.debug.print("{}\n", .{0.1 + 0.2 == 0.3});
}

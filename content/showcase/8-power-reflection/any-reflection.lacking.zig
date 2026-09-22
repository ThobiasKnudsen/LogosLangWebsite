// @typeInfo reads a function's parameters and return
// type at compile time; its body cannot be read
const std = @import("std");

fn power(b: i32, n: u32) i32 {
    var r: i32 = 1;
    for (0..n) |_| r *= b;
    return r;
}

pub fn main() void {
    const info = @typeInfo(@TypeOf(power)).@"fn";
    std.debug.print("{d} {s}\n", .{
        info.params.len,
        @typeName(info.return_type.?),
    });
}

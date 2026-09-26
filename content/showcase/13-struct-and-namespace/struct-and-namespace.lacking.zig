// lacking: `Point.dims` cannot be read through a value
// a struct is also a namespace: a decl inside it is
// read through the type, never through a value
const std = @import("std");

const Point = struct {
    x: i32,
    y: i32,
    const dims: i32 = 2;
};

pub fn main() void {
    const p = Point{ .x = 1, .y = 2 };
    std.debug.print("{d} {d}\n", .{p.x, Point.dims});
}

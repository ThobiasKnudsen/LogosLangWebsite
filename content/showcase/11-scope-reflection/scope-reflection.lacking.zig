// lacking: file, line and the type around; the scopes above are not values
// @src() is the spot a line is written at and @This()
// the type around it; the scopes above are not values
const std = @import("std");

pub fn main() void {
    const here = @src();
    std.debug.print("{s}:{d}\n", .{
        here.file, here.line,
    });
}

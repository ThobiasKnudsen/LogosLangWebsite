// lacking: prefix only; `4 TWICE` cannot be written
// a macro rewrites text before the compiler reads it;
// prefix only, never `4 TWICE`
#include <stdio.h>
#define TWICE(e) ((e) * 2)

int main(void) {
    printf("%d\n", 3 + TWICE(4)); /* 11 */
    return 0;
}

// the answer, computed the long way
#include <stdio.h>

/* double is a keyword, so: */
int twice(int x) { return x + x; }

int main(void) {
    int sum = 0;
    for (int i = 0; i < 7; i++) sum += i;
    printf("%d\n", twice(sum)); /* 42 */
    return 0;
}

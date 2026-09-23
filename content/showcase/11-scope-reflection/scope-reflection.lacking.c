// the spot a line is written at is text, not a scope:
// its file and line; nothing walks up from it
#include <stdio.h>

int main(void) {
    printf("%s:%d\n", __FILE__, __LINE__);
    return 0;
}

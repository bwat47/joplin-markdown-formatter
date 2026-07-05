| i | ch | isEscaped before | Action |
| --- | --- | --- | --- |
| 0 | a | false | normal char test typing in a cell |
| 2 | \\ | false | set `isEscaped = true`, skip |
| 3 | \| | true | reset `isEscaped = false`, skip this `\|` entirely |
| 4 | ␣ | false | *normal* char |
| 5 | b | false | normal char |

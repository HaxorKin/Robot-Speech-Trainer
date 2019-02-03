# Robot Speech Trainer

This small JavaScript program can convert text to look robotic based on rules/patterns<br>
The important part of it can run in browser too, the repository has a working Discord bot<br>
Try the demo! https://haxorkin.github.io/Robot-Speech-Trainer<br>
<br>
Patterns: (a pattern shouldn't be longer than 9 parts)<br>
<br>
```
I/me - this unit
```
Explanation: the word 'I' or the word 'me' (canse insensitive) are replaced with two words 'this unit'<br>
<br>
```
called * - *, *
```
Explanation: 'called' followed by any word are kept how they are unless matched by a bigger pattern<br>
The parts that identify the new words are comma separated because one word can be replaced by multiple, if you want to replace with less words, use '\~'<br>
'\*' will match any word and in the replacement part, it will keep the original word, '\~' can only be used in the replacement and it indicates the removal of a word<br>
<br>
```
[yes|ye] - [affirmative 10| confirmed 3| positive 1| return true 1]
```
Explanation: Whole input match of 'yes' or 'ye' (case insensitive) are replaced with the following words, with an optional weight for weighted random added.<br>
<br>
<br>
Check out my Discord server https://discord.gg/T3umFMZ

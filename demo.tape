# VHS tape - scaffolding for a future demo GIF.
# Install VHS (https://github.com/charmbracelet/vhs), then: vhs demo.tape
# Not run as part of this build - written as scaffolding only.

Output demo.gif

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 720
Set Theme "Dracula"
Set Padding 20

Type "npx github:jimmyjames177414/claude-roundtable ""should I use Redux or Zustand?"" --judge"
Sleep 500ms
Enter

Sleep 20s

Type "exit"
Enter

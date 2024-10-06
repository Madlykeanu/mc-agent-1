# mc-agent-1

excuse my garbage code i made most of this in like a week as an experiment

basically writes its own mineflayer scripts to control itself based on what you tell it to do.
still very basic atm and cannot perform complex tasks(eg "goto the nether" when it just spawned in with nothing) but it can do relatively simple things like get you wood or mine for you semi reliably.
this is basically just a proof of concept/experiment so expect loads of bugs if you try to run it

i dont plan to develop this further as i have another mc agent im working on that will be completely rewriten to be better with what i learned from this project.

todo:
- ~~add a way for the ai to update descriptions of tools/command if it comes across new information about the command~~

- some kind of planning framework? currently it will try to generate a script for any task even very complex goals(for example asking it to try to get to the nether when it just spawned in a new world) it should break down complex tasks into smaller subtasks if the goal is complex(for going to the nether it could maybe have subgoals of collect wood, craft basic tools, gather food etc), and when it completes the task it should evaluate its progress and update the plan if neccessary, we should use the smartest model possible for this. it should then create scripts to complete the smaller tasks one by one until the goal is completed
(
- maybe attempt to modify prism launcher or a lightweight launcher to be able to controle your bots manually, this would make it mucb easier to get bots into servers with captchas and stuff like that since you could do the captcha the  turn on the bot and let it take control, we could maybe even have ability to enter tasks for the ai agent in the client, visualizations of the ai breaking down tasks(when we implement task breakdown for complex tasks), and the currently running tasks

- add progress evaluation agent for inprogress scripts? when a script is running, every 15 seconds send a prompt to ai asking it to evaluate whether the script is working properly, for context show the bots state(inventory, stats,environment info etc) 15 seconds ago vs the current state, and the script,it cam return json with reasoning and isWorking and properties, if it thinks the script isnt working as intended it cam return the isWorking false and include its reasoning as to why it thinks the script isnt working, if isWorking is false then we can send it to the coding agent with the reasoning as to why its nkt working and it can fix it and reexecute it with the fixes


- implement on the fly iteration of scripts, so if for example its currently running a script that is making it strip mine and it gets stuck or something i can sy hey your stuck on something and it can rewrite the script  and reexecute to better match my requirements 
- add more relevant context for when the ai tries to fix a script that comes across and error, for example if the script has been attempted to be fixed multiple times it should include all the previous errors and attempted fixes to have the best chance of actually solving it instead of potentially going in loops
- add feedback for the ai when it tries to use a tool/commands that dosnt exist in its tool library yet
- maybe the ai can test if the command actually works before saving it?
- maybe instead of creating the response before the command executes(in the message field) when it uses one it can execute the command then come up with a response after so if theres an error or something it can tell you about it or try a different way 

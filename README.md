- ~~add a way for the ai to update descriptions of tools/command if it comes across new information about the command~~

- add progress evaluation agent for inprogress scripts? when a script is running, every 15 seconds send a prompt to ai asking it to evaluate whether the script is working properly, for context show the bots state(inventory, stats,environment info etc) 15 seconds ago vs the current state, and the script,it cam return json with reasoning and isWorking and properties, if it thinks the script isnt working as intended it cam return the isWorking false and include its reasoning as to why it thinks the script isnt working, if isWorking is false then we can send it to the coding agent with the reasoning as to why its nkt working and it can fix it and reexecute it with the fixes


- implement on the fly iteration of scripts, so if for example its currently running a script that is making it strip mine and it gets stuck or something i can sy hey your stuck on something and it can rewrite the script  and reexecute to better match my requirements 
- add more relevant context for when the ai tries to fix a script that comes across and error, for example if the script has been attempted to be fixed multiple times it should include all the previous errors and attempted fixes to have the best chance of actually solving it instead of potentially going in loops
- add feedback for the ai when it tries to use a tool/commands that dosnt exist in its tool library yet
- maybe the ai can test if the command actually works before saving it?
- maybe instead of creating the response before the command executes(in the message field) when it uses one it can execute the command then come up with a response after so if theres an error or something it can tell you about it or try a different way 

### Oh... so that's how `npm install` works
---
I made this tool because I was under the assumption that `npm install` and `npm update` would not install any of the modules if one of them failed. This assumption is incorrect; apparently I didn't pay enough attention. I suppose this tool could still be useful if you wanted to suppress the error messages, but redirecting stdout and stderr would be more effective.

Though the tool isn't worth much, it was an educational experience escaping from callback hell and implementing promises using Q. Thus, while I unpublished the module from the NPM registry, I'm leaving the code here for later reference.


# npmexclude
--------------
A tool to exclude certain modules from `npm install` and `npm update`. 

Unfortunately, NPM does not always install modules successfully on every system, meaning that sometimes it is necessary to compile the module from source specifically for your system. However, executing `npm install` or `npm update` will still return a litany of errors when it tries to install or update that particular module. 

This command-line tool allows you to exclude/hide certain modules from npm. Specifically, the tool copies the given module folders to a temporary directory and removes them as dependencies from your package.json file. Once npm has completed installing or updating, the modules are moved back and your package.json is restored.

### Installation
---
```sh
npm install -g npmexclude
```

### Usage
---
The tool needs to be run from the directory containing package.json.
```sh
npmexclude [ -v ][--update | --production ] [ --moduleDir=/path/to/node_modules ] [ --tmpDir=/path/to/tmpDir ] module1 module2 ...
```
e.g.
```sh
npmexclude --production java
```

For debugging and other informational messages, set the DEBUG environment variable before running the tool. (The * can be replaced with either 'debug' or 'info').
```sh
# Linux
DEBUG=npmexclude:*
# Windows
set DEBUG=npmexclude:*
```

### License
---
The MIT License (MIT)

Copyright (c) 2015 Benjamin Lane &lt;balane3@ncsu.edu&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

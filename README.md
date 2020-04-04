## Simpel TypeScript runtime

A small standalone barebone TypeScript runtime (\~750kb) built on top of [DumbJS](https://github.com/isRyven/DumbJS).  
Attempts to ignore typechecking, yielding only syntatic errors.
Does not support map files yet.

```sh
mkdir build && cd build
cmake ..
cmake --build .
cat > example.ts << heredoc
	import * as fs from 'fs';
	import * as utils from 'utils';
	const transport: string[] = ["Car", "Plane", "Train", "Truck"];
	const data: string[] = [];
	for (let i = 0; i < transport.length; i++) {
		data.push(utils.format("%i %s", i + 1, transport[i]));
	}
	fs.writeFileSync('transport.txt', data.join('\n'));
	console.log('done');
heredoc
./tsr example.ts
```

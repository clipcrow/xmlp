# SAX Parser for Deno

The basic logic of this sax-parser was obtained by reading the source code of [sax-js](https://github.com/isaacs/sax-js). Thanks.

## Usage

```typescript
import { SAXParser } from 'https://denopkg.com/m-kur/saxp/mod.ts';

const parser = new SAXParser();
parser.on('start_prefix_mapping', (ns, uri) => {
    console.log(`mapping start ${ns}: ${uri}`);
}).on('end_prefix_mapping', (ns, uri) => {
    console.log(`mapping end ${ns}: ${uri}`);
});
const file = await Deno.open('mod_test.xml');
await Deno.copy(file, parser.getWriter());
file.close();
```

## License

The scripts and documentation in this project are released under the
[MIT License](LICENSE)

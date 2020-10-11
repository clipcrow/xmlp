# XML Parser for Deno

[![ci](https://github.com/m-kur/saxp/workflows/ci/badge.svg)](https://github.com/m-kur/saxp/actions)

The basic logic of this XML parser was obtained by reading the source code of [sax-js](https://github.com/isaacs/sax-js). Thanks.

## Usage

```typescript
import { SAXParser } from 'https://denopkg.com/m-kur/saxp@v0.4/mod.ts';

// create a SAX parser instance
const parser = new SAXParser();

// add SAX event handlers
parser.on('start_prefix_mapping', (ns, uri) => {
    console.log(`mapping start ${ns}: ${uri}`);
}).on('text', (text, element) => {
    if (element.qName === 'm:comment') {
        console.log(`${element.attributes[0].value}: ${text}`);
    }
});

// run parser, input source is Deno.Reader
const file = await Deno.open('parser_test.xml');
await parser.parse(file);
file.close();
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

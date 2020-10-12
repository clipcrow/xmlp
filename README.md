# XML Parser for Deno

[![ci](https://github.com/m-kur/xmlp/workflows/ci/badge.svg)](https://github.com/m-kur/xmlp/actions)

## SAXParser

```typescript
import { SAXParser } from 'https://denopkg.com/m-kur/xmlp@v0.10/mod.ts';

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

// run parser, input source is Deno.Reader or Uint8Array or string
const file = await Deno.open('parser_test.xml');
await parser.parse(file);
file.close();
```

## PullParser

```typeScript
import { PullParser } from 'https://denopkg.com/m-kur/xmlp@v0.10/mod.ts';

// create a pull parser instance
const parser = new PullParser();

// create an ES6 generator
const file = await Deno.readFile('parser_test.xml');
const events = parser.parse(file);

// pull events, using iterator
console.log([...events].filter(({ name }) => {
    return name === 'text';
}).map(({ text, cdata }) => {
    return cdata ? `<![CDATA[${text}]]>` : text;
}));
```

## DOMParser

Will be realized eventually.

## Acknowledgments

The basic logic of this XML parser was obtained by reading the source code of [sax-js](https://github.com/isaacs/sax-js). Thanks.


## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

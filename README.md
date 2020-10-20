# XML Parser for Deno

[![ci](https://github.com/m-kur/xmlp/workflows/ci/badge.svg)](https://github.com/m-kur/xmlp/actions)

This project is an XML parser implemented for Deno as simply as possible. Currently it supports SAX style and Pull style.
I'm thinking of using it only in applications that run on Deno. However, there is very little code that depends on Deno, so it's easy to make it available in Node (I don't).
If you haven't programmed with Deno yet, give it a try. Very nice. See [Deno official](https://deno.land/).

## SAXParser

When using in SAX style, create an instance of the parser and register the listener in the same way as used in the EventEmitter of Node.
The XML to be parsed is specified by Deno.Reader, UINT8 array, or a character string.

```typescript
import { SAXParser } from 'https://deno.land/x/xmlp/mod.ts';

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
const reader = await Deno.open('parser_test.xml');
await parser.parse(reader);
reader.close();
```

SAX event listener register definitions are below.

```typescript
on(event: 'start_document', listener: () => void): this;
on(event: 'processing_instruction', listener: (procInst: string) => void): this;
on(event: 'sgml_declaration', listener: (sgmlDecl: string) => void): this;
on(event: 'text', listener: (text: string, element: ElementInfo, cdata: boolean) => void): this;
on(event: 'doctype', listener: (doctype: string) => void): this;
on(event: 'start_prefix_mapping', listener: (ns: string, uri: string) => void): this;
on(event: 'start_element', listener: (element: ElementInfo) => void): this;
on(event: 'comment', listener: (comment: string) => void): this;
on(event: 'end_element', listener: (element: ElementInfo) => void): this;
on(event: 'end_prefix_mapping', listener: (ns: string, uri: string) => void): this;
on(event: 'end_document', listener: () => void): this;
on(event: 'error', listener: (error: XMLParseError) => void): this;
```

You can use "SAXParser" on Deno's stream i/o because this is a simple "UnderlyingSink<Uint8Array>" impl.
See the [parser.ts](parser.ts) / SAXParser#parse() -> #getWriter() -> getStream() -> write() chain.

## PullParser

I think it's more interesting to write the Pull style than the SAX. This Pull parser is implemented using the ES6 Generator / Iterator mechanism. However, the basic implementation is shared with that of the SAX parser.

Currently the Pull parser supports Uint8 arrays and strings, not Deno.Reader.

```typescript
import { PullParser } from 'https://deno.land/x/xmlp/mod.ts';

// create a pull parser instance
const parser = new PullParser();

// create an ES6 generator
const uint8Array = await Deno.readFile('parser_test.xml');
const events = parser.parse(uint8Array);

// pull events, using iterator
const event = events.next();
if (event.value) {
    console.log(event.value.name);
}

// using spread operator
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

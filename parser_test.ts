import { assert, assertEquals } from 'https://deno.land/std@0.74.0/testing/asserts.ts';
import { ParserBase, SAXParser } from './parser.ts';

Deno.test('ParserBase chunk & hasNext & readNext & position', () => {
    // protected -> public visiblity
    class TestParser extends ParserBase {
        set chunk(chunk: string) {
            super.chunk = chunk;
        }

        readNext(): string {
            return super.readNext();
        }

        hasNext(): boolean {
            return super.hasNext();
        }
    }
    const parser = new TestParser();
    parser.chunk = 'a\nb';
    assertEquals(parser.readNext(), 'a');
    assertEquals(parser.position, { line: 1, column: 1 });
    assertEquals(parser.hasNext(), true);
    assertEquals(parser.readNext(), '\n');
    assertEquals(parser.position, { line: 2, column: 0 });
    assertEquals(parser.readNext(), 'b');
    assertEquals(parser.position, { line: 2, column: 1 });
    assertEquals(parser.hasNext(), false);
});

Deno.test('SAXParser on & parse', async () => {
    const parser = new SAXParser();
    let assertionCount = 0;
    let elementCount = 0;
    parser.on('start_prefix_mapping', (ns, uri) => {
        assertionCount += 1;
        if (ns === 'atom') {
            assertEquals(uri, 'http://www.w3.org/2005/Atom');
        } else if (ns === 'm') {
            assertEquals(uri, 'https://xmlp.test/m');
        } else {
            assert(false);
        }
    }).on('start_element', (element) => {
        elementCount += 1;
        if (element.qName === 'guid') {
            assertionCount += 1;
            assertEquals(element.attributes[0].qName, 'isPermaLink');
            assertEquals(element.attributes[0].value, 'false');
        }
    });
    const file = await Deno.open('parser_test.xml');
    await parser.parse(file);
    file.close();
    assertEquals(assertionCount, 3);
    assertEquals(elementCount, 18);
});

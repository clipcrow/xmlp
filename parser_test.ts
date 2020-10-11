import { assertEquals } from 'https://deno.land/std@0.74.0/testing/asserts.ts';
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

Deno.test('sax parse', async () => {
    const parser = new SAXParser();
    parser.on('start_prefix_mapping', (ns, uri) => {
        console.log(`mapping start ${ns}: ${uri}`);
    }).on('end_prefix_mapping', (ns, uri) => {
        console.log(`mapping end ${ns}: ${uri}`);
    });
    const file = await Deno.open('parser_test.xml');
    await Deno.copy(file, parser.getWriter());
    file.close();
});

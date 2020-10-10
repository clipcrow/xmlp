import { assertEquals } from 'https://deno.land/std@0.73.0/testing/asserts.ts';
import { SAXParser } from './mod.ts';

Deno.test('SAXParser chunk & hasNext & readNext & position', () => {
    // protected -> public visiblity
    class TestParser extends SAXParser {
        set chunk(chunk: Uint8Array) {
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
    parser.chunk = new TextEncoder().encode('a\nb');
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
    const file = await Deno.open('test.xml');
    await Deno.copy(file, parser.getWriter());
    file.close();
});

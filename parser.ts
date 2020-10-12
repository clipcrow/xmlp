import { Locatable, XMLParseHandler, XMLParseContext, XMLPosition, ElementInfo, XMLParseEvent } from './context.ts';
import * as handler from './handler.ts';

export class ParserBase implements Locatable {
    private _cx = new XMLParseContext(this);
    private _handlers: { [state: string]: XMLParseHandler } = {};
    private _chunk = '';
    private _index = -1;
    private _position: XMLPosition = { line: 1, column: 0 };

    /*
        The basic logic of this XML parser was obtained by reading the source code of sax-js.
        Thanks & see: https://github.com/isaacs/sax-js

        STATE                     XML
        ------------------------  ------------------
        BEFORE_DOCUMENT
        GENERAL_STUFF
        FOUND_LT                  <
        PROC_INST                 <?
        PROC_INST_ENDING          <? proc ?
        SGML_DECL                 <!
        CDATA                     <![CDATA[
        CDATA_ENDING              <![CDATA[ cdata ]
        CDATA_ENDING_2            <![CDATA[ cdata ]]
        COMMENT                   <!--
        COMMENT_ENDING            <!-- comment -
        COMMENT_ENDING_2          <!-- comment --
        DOCTYPE                   <!DOCTYPE
        START_TAG                 <element
        START_TAG_STUFF           <element%20
        EMPTY_ELEMENT_TAG         <element/
        ATTRIBUTE_NAME            <element a
        ATTRIBUTE_NAME_SAW_WHITE  <element a%20
        ATTRIBUTE_EQUAL           <element a=
        ATTRIBUTE_VALUE_START     <element a="
        ATTRIBUTE_VALUE_END       <element a="value"
        END_TAG                   </element
        END_TAG_SAW_WHITE         </element%20
        AFTER_DOCUMENT
    */
    constructor() {
        this.appendHandler('BEFORE_DOCUMENT', handler.handleBeforeDocument);
        this.appendHandler('GENERAL_STUFF', handler.handleGeneralStuff);
        this.appendHandler('FOUND_LT', handler.handleFoundLT);
        this.appendHandler('PROC_INST', handler.handleProcInst);
        this.appendHandler('PROC_INST_ENDING', handler.handleProcInstEnding);
        this.appendHandler('SGML_DECL', handler.handleSgmlDecl);
        this.appendHandler('CDATA', handler.handleCdata);
        this.appendHandler('CDATA_ENDING', handler.handleCdataEnding);
        this.appendHandler('CDATA_ENDING_2', handler.handleCdataEnding2);
        this.appendHandler('COMMENT', handler.handleComment);
        this.appendHandler('COMMENT_ENDING', handler.handleCommentEnding);
        this.appendHandler('COMMENT_ENDING_2', handler.handleCommentEnding2);
        this.appendHandler('DOCTYPE', handler.handleDoctype);
        this.appendHandler('START_TAG', handler.handleStartTag);
        this.appendHandler('START_TAG_STUFF', handler.handleStartTagStuff);
        this.appendHandler('EMPTY_ELEMENT_TAG', handler.handleEmptyElementTag);
        this.appendHandler('ATTRIBUTE_NAME', handler.handleAttributeName);
        this.appendHandler('ATTRIBUTE_NAME_SAW_WHITE', handler.handleAttributeNameSawWhite);
        this.appendHandler('ATTRIBUTE_EQUAL', handler.handleAttributeEqual);
        this.appendHandler('ATTRIBUTE_VALUE_START', handler.handleAttributeValueStart);
        this.appendHandler('ATTRIBUTE_VALUE_END', handler.handleAttributeValueEnd);
        this.appendHandler('END_TAG', handler.handleEndTag);
        this.appendHandler('END_TAG_SAW_WHITE', handler.handleEndTagSawWhite);
        this.appendHandler('AFTER_DOCUMENT', handler.handleAfterDocument);
    }

    protected get cx(): XMLParseContext {
        return this._cx;
    }

    protected appendHandler(state: string, handler: XMLParseHandler): this {
        this._handlers[state] = handler;
        return this;
    }

    protected get handlers(): { [state: string]: XMLParseHandler } {
        return this._handlers;
    }

    protected set chunk(chunk: string) {
        this._chunk = chunk;
        this._index = -1;
    }

    protected hasNext(): boolean {
        return this._index < this._chunk.length - 1;
    }

    protected readNext(): string {
        this._index += 1;
        const c = this._chunk[this._index];
        if (c === '\n') {
            this._position.line += 1;
            this._position.column = 0;
        } else {
            this._position.column += 1;
        }
        return c;
    }

    get position(): XMLPosition {
        return this._position;
    }
}

// deno-lint-ignore no-explicit-any
type SAXListener = (...arg: any[]) => void;

export class SAXParser extends ParserBase implements UnderlyingSink<Uint8Array> {
    private _listeners: { [event: string]: SAXListener[] } = {};
    private _controller?: WritableStreamDefaultController;

    protected fireListeners(event: XMLParseEvent) {
        const [name, ...args] = event;
        const list = this._listeners[name] || [];
        for (const listener of list) {
            listener.call(this, ...args);
        }
    }

    protected run() {
        while(this.hasNext()) {
            const state = this.cx.state;
            const handler = this.handlers[state];
            if (!handler) {
                throw new Error(`Handler for ${state} not found`);
            }
            const c = this.readNext();
            const events = handler(this.cx, c);
            for (const event of events) {
                this.fireListeners(event);
            }
        }
    }

    write(chunk: Uint8Array, controller?: WritableStreamDefaultController) {
        // TextDecoder can resolve BOM.
        this.chunk = new TextDecoder().decode(chunk);
        this._controller = controller;
        try {
            this.run();
        } catch(e) {
            this._controller?.error(e);
            this.fireListeners(['error', e]);
        } finally {
            this._controller = undefined;
        }
    }

    getStream(): WritableStream<Uint8Array> {
        return new WritableStream<Uint8Array>(this);
    }

    getWriter(): Deno.Writer {
        const streamWriter = this.getStream().getWriter();
        return {
            async write(p: Uint8Array): Promise<number> {
                await streamWriter.ready;
                await streamWriter.write(p);
                return p.length;
            }
        };
    }

    async parse(source: Deno.Reader | Uint8Array | string) {
        if (typeof source === 'string') {
            this.chunk = source;
            this.run();
        } else if (source instanceof Uint8Array) {
            this.write(source);
        } else {
            await Deno.copy(source, this.getWriter());
        }
    }

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
    // deno-lint-ignore no-explicit-any
    on(event: 'error', listener: (error: any) => void): this;
    on(event: string, listener: SAXListener): this {
        const list = this._listeners[event] || [];
        list.push(listener);
        this._listeners[event] = list;
        return this;
    }
}

export type PullResult = {
    name: string;
    // deno-lint-ignore no-explicit-any
    [key: string]: any;
}

export class PullParser extends ParserBase {
    protected marshallEvent(event: XMLParseEvent): PullResult {
        const name = event[0];
        const result: PullResult = { name };
        if (name === 'processing_instruction') {
            result['procInst'] = event[1];
        } else if (name === 'sgml_declaration') {
            result['sgmlDecl'] = event[1];
        } else if (name === 'text') {
            result['text'] = event[1];
            result['element'] = event[2];
            result['cdata'] = event[3];
        } else if (name === 'doctype') {
            result['doctype'] = event[1];
        } else if (name === 'start_prefix_mapping' || name === 'end_prefix_mapping') {
            result['ns'] = event[1];
            result['uri'] = event[2];
        } else if (name === 'start_element' || name === 'end_element') {
            result['element'] = event[1];
        } else if (name === 'comment') {
            result['comment'] = event[1];
        }
        return result;
    }

    * parse(source: Uint8Array | string) {
        this.chunk = typeof source === 'string' ? source : new TextDecoder().decode(source);
        try {
            while(this.hasNext()) {
                const state = this.cx.state;
                const handler = this.handlers[state];
                if (!handler) {
                    throw `Handler for ${state} not found`;
                }
                const events = handler(this.cx, this.readNext());
                for (const event of events) {
                    yield this.marshallEvent(event);
                }
            }
        } catch(e) {
            yield { name: 'error', error: e };
        }
    }
}

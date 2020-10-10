import { Emittable, Locatable, SAXHandler, SAXContext, SAXPosition, ElementInfo } from './context.ts';
import * as handler from './handler.ts';

// deno-lint-ignore no-explicit-any
type SAXListener = (...arg: any[]) => void;

export class SAXParser implements Emittable, Locatable, UnderlyingSink<Uint8Array> {
    private _handlers: { [state: string]: SAXHandler } = {};
    private _listeners: { [event: string]: SAXListener[] } = {};
    private _controller?: WritableStreamDefaultController;
    private _cx = new SAXContext(this);
    private _chunk = '';
    private _index = -1;
    private _position: SAXPosition = { line: 1, column: 0 };
    private _current = '';

    /*
        The basic design of this sax-parser was obtained by reading the source code of SAX-JS.
        Thanks & see: https://github.com/isaacs/sax-js

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

    appendHandler(state: string, handler: SAXHandler): this {
        this._handlers[state] = handler;
        return this;
    }

    protected set chunk(chunk: Uint8Array) {
        // TextDecoder cn resolve BOM.
        this._chunk = new TextDecoder().decode(chunk);
        this._index = -1;
    }

    protected hasNext(): boolean {
        return this._index < this._chunk.length - 1;
    }

    protected readNext(): string {
        this._index += 1;
        this._current = this._chunk[this._index];
        if (this._current === '\n') {
            this._position.line += 1;
            this._position.column = 0;
        } else {
            this._position.column += 1;
        }
        return this._current;
    }

    get position(): SAXPosition {
        return this._position;
    }

    write(chunk: Uint8Array, controller: WritableStreamDefaultController) {
        this._controller = controller;
        try {
            this.chunk = chunk;
            while(this.hasNext()) {
                const state = this._cx.state;
                const handler = this._handlers[state];
                if (!handler) {
                    throw new Error(`Handler for ${state} not found`);
                }
                const c = this.readNext();
                handler(this._cx, c, this);
            }
        } catch(e) {
            this._controller?.error(e);
            throw e;
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

    on(event: 'start_document', listener: () => void): this;
    on(event: 'doctype', listener: (doctype: string) => void): this;
    on(event: 'sgml_declaration', listener: (sgmlDecl: string) => void): this;
    on(event: 'processing_instruction', listener: (procInst: string) => void): this;
    on(event: 'start_prefix_mapping', listener: (ns: string, uri: string) => void): this;
    on(event: 'start_element', listener: (element: ElementInfo) => void): this;
    on(event: 'text', listener: (text: string, cdata: boolean, element: ElementInfo) => void): this;
    on(event: 'comment', listener: (comment: string) => void): this;
    on(event: 'end_element', listener: (element: ElementInfo) => void): this;
    on(event: 'end_prefix_mapping', listener: (ns: string, uri: string) => void): this;
    on(event: 'end_document', listener: () => void): this;
    on(event: string, listener: SAXListener): this {
        const list = this._listeners[event] || [];
        list.push(listener);
        this._listeners[event] = list;
        return this;
    }

    // deno-lint-ignore no-explicit-any
    emit(event: string, ...args: any[]) {
        const list = this._listeners[event];
        if (list) {
            list.forEach((listener) => {
                listener.call(this, ...args);
            });
        }
    }
}

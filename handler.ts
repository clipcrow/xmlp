import { Emittable, SAXContext, SAXError, ElementInfo } from './context.ts';

const NAME_HEAD = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/
const NAME_BODY = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/

function isWhitespace(c: string): boolean {
    return c === ' ' || c === '\n' || c === '\r' || c === '\t';
}

// BEFORE_DOCUMENT; FOUND_LT, Error
export function handleBeforeDocument(cx: SAXContext, c: string, emitter: Emittable) {
    if (c === '<') {
        emitter.emit('start_document');
        cx.state = 'FOUND_LT';
    } else {
        if (!isWhitespace(c)) {
            throw new SAXError('Non-whitespace before document.', cx);
        }
    }
}

// GENERAL_STUFF; FOUND_LT
export function handleGeneralStuff(cx: SAXContext, c: string) {
    if (c === '<') {
        cx.state = 'FOUND_LT';
    } else {
        if (!isWhitespace(c)) {
            cx.appendMemento(c);
        }
    }
}

function resolveEntity(text: string): string {
    let result = text;
    [
        [/&amp;/g, '&'],
        [/&gt;/g, '>'],
        [/&lt;/g, '<'],
        [/&quot;/g, '"'],
        [/&apos;/g, '\''],
    ].forEach(([reg, ch]) => {
        result = result.replace(reg, ch as string);
    });
    return result;
}

// FOUND_LT; SGML_DECL, START_TAG, END_TAG, PROC_INST, Error
export function handleFoundLT(cx: SAXContext, c: string, emitter: Emittable) {
    const text = resolveEntity(cx.memento);
    cx.clearMemento();
    if (text) {
        emitter.emit('text', text, false, new ElementInfo(cx.peekElement()!));
    }
    if (!isWhitespace(c)) {
        if (c === '?') {
            cx.state = 'PROC_INST';
        } else if (c === '!') {
            cx.state = 'SGML_DECL';
        } else if (NAME_HEAD.test(c)) {
            cx.appendMemento(c);
            cx.state = 'START_TAG';
        } else if (c === '/') {
            cx.state = 'END_TAG';
        } else {
            throw new SAXError('Unencoded <', cx);
        }
    }
}

// PROC_INST; PROC_INST_ENDING
export function handleProcInst(cx: SAXContext, c: string) {
    if (c === '?') {
        cx.state = 'PROC_INST_ENDING';
    } else {
        cx.appendMemento(c);
    }
}

// PROC_INST_ENDING; processing_instruction & GENERAL_STUFF, PROC_INST
export function handleProcInstEnding(cx: SAXContext, c: string, emitter: Emittable) {
    if (c === '>') {
        emitter.emit('processing_instruction', cx.memento);
        cx.clearMemento();
        cx.state = 'GENERAL_STUFF';
    } else {
        cx.appendMemento(`?${c}`);
        cx.state = 'PROC_INST';
    }
}

// SGML_DECL; CDATA, COMMENT, DOCTYPE, GENERAL_STUFF, Error
export function handleSgmlDecl(cx: SAXContext, c: string, emitter: Emittable) {
    const sgmlCmd = `${cx.memento}${c}`.toUpperCase();
    if (sgmlCmd === '[CDATA[') {
        cx.clearMemento();
        cx.state = 'CDATA';
    } else if (sgmlCmd === '--') {
        cx.clearMemento();
        cx.state = 'COMMENT';
    } else if (sgmlCmd === 'DOCTYPE') {
        if (cx.elementLength > 0) {
            throw new SAXError('Inappropriately located doctype declaration', cx);
        }
        cx.clearMemento();
        cx.state = 'DOCTYPE';
    } else if (c === '>') {
        emitter.emit('sgml_declaration', cx.memento);
        cx.clearMemento();
        cx.state = 'GENERAL_STUFF';
    } else {
        cx.appendMemento(c);
    }
}

// CDATA; CDATA_ENDING
export function handleCdata(cx: SAXContext, c: string) {
    if (c === ']') {
        cx.state = 'CDATA_ENDING';
    } else {
        cx.appendMemento(c);
    }
}

// CDATA_ENDING; CDATA_ENDING_2, CDATA
export function handleCdataEnding(cx: SAXContext, c: string) {
    if (c === ']') {
        cx.state = 'CDATA_ENDING_2';
    } else {
        cx.appendMemento(`]${c}`);
        cx.state = 'CDATA';
    }
}

// CDATA_ENDING_2; text & GENERAL_STUFF, CDATA
export function handleCdataEnding2(cx: SAXContext, c: string, emitter: Emittable) {
    if (c === '>') {
        if (cx.memento) {
            emitter.emit('text', cx.memento, true, new ElementInfo(cx.peekElement()!));
            cx.clearMemento();
        }
        cx.state = 'GENERAL_STUFF';
    } else if (c === ']') {
        cx.appendMemento(']');
    } else {
        cx.appendMemento(`]]${c}`);
        cx.state = 'CDATA';
    }
}

// COMMENT; COMMENT_ENDING
export function handleComment(cx: SAXContext, c: string) {
    if (c === '-') {
        cx.state = 'COMMENT_ENDING';
    } else {
        cx.appendMemento(c);
    }
}

// COMMENT_ENDING; COMMENT_ENDING2, COMMENT
export function handleCommentEnding(cx: SAXContext, c: string) {
    if (c === '-') {
        cx.state = 'COMMENT_ENDING_2';
    } else {
        cx.appendMemento(`-${c}`);
        cx.state = 'COMMENT';
    }
}

// COMMENT_ENDING_2; comment & GENERAL_STUFF, COMMENT
export function handleCommentEnding2(cx: SAXContext, c: string, emitter: Emittable) {
    if (c === '>') {
        const comment = cx.memento;
        if (comment) {
            emitter.emit('comment', comment);
        }
        cx.clearMemento();
        cx.state = 'GENERAL_STUFF';
    } else {
        cx.appendMemento(`--${c}`);
        cx.state = 'COMMENT';
    }
}

// DOCTYPE; doctype & GENERAL_STUFF
export function handleDoctype(cx: SAXContext, c: string, emitter: Emittable) {
    if (c === '>') {
        emitter.emit('doctype', cx.memento);
        cx.clearMemento();
        cx.state = 'GENERAL_STUFF';
    } else {
        cx.appendMemento(c);
    }
}

function emitStartElement(emitter: Emittable, cx: SAXContext) {
    const element = cx.peekElement()!;
    element.prefixMappings.forEach(({ ns, uri}) => {
        cx.registerNamespace(ns, uri);
        emitter.emit('start_prefix_mapping', ns, uri);
    })
    // Setting Namespace URI to this element and all attributes.
    element.uri = cx.getNamespaceURI(element.prefix);
    element.attributes.forEach((attribute) => {
        attribute.uri = cx.getNamespaceURI(attribute.prefix);
    });
    emitter.emit('start_element', new ElementInfo(element));
}

// START_TAG; start_element & GENERAL_STUFF, EMPTY_ELEMENT_TAG, START_TAG_STUFF, Error
export function handleStartTag(cx: SAXContext, c: string, emitter: Emittable) {
    if (NAME_BODY.test(c)) {
        cx.appendMemento(c);
    } else {
        cx.newElement(cx.memento);
        cx.clearMemento();
        if (c === '>') {
            emitStartElement(emitter, cx);
            cx.state = 'GENERAL_STUFF';
        } else if (c === '/') {
            cx.state = 'EMPTY_ELEMENT_TAG';
        } else {
            if (!isWhitespace(c)) {
                throw new SAXError('Invalid character in element name', cx);
            }
            cx.state = 'START_TAG_STUFF';
        }
    }
}

// ELEMENT_STUFF; start_element & GENERAL_STUFF, EMPTY_ELEMENT_TAG, ATTRIBUTE_NAME, Error
export function handleStartTagStuff(cx: SAXContext, c: string, emitter: Emittable) {
    if (!isWhitespace(c)) {
        if (c === '>') {
            emitStartElement(emitter, cx);
            cx.state = 'GENERAL_STUFF';
        } else if (c === '/') {
            cx.state = 'EMPTY_ELEMENT_TAG';
        } else if (NAME_HEAD.test(c)) {
            cx.appendMemento(c);
            cx.state = 'ATTRIBUTE_NAME';
        } else {
            throw new SAXError('Invalid attribute name', cx);
        }
    }
}

function emitEndElement(emitter: Emittable, cx: SAXContext, qName: string) {
    const element = cx.popElement()!;
    if (element.qName !== qName) {
        throw new SAXError(`Illegal element structure, ${element.qName} & ${qName}`, cx);
    }
    emitter.emit('end_element', new ElementInfo(element));
    element.prefixMappings.forEach((mapping) => {
        emitter.emit('end_prefix_mapping', mapping.ns, mapping.uri);
    })
}

// EMPTY_ELEMENT_TAG; start_element & end_element & GENERAL_STUFF, Error
export function handleEmptyElementTag(cx: SAXContext, c: string, emitter: Emittable) {
    if (c !== '>') {
        throw new SAXError('Forward-slash in start-tag not followed by &gt', cx);
    }
    const element = cx.peekElement()!;
    element.standAlone = true;
    emitStartElement(emitter, cx);
    emitEndElement(emitter, cx, element.qName);
    cx.state = 'GENERAL_STUFF';
}

function newAttribute(cx: SAXContext) {
    const qName = cx.memento;
    cx.clearMemento();
    cx.peekElement()!.newAttribute(qName);
    cx.state = 'ATTRIBUTE_EQUAL';
}

// ATTRIBUTE_NAME; ATTRIBUTE_EQUAL, ATTRIBUTE_NAME_SAW_WHITE, Error
export function handleAttributeName(cx: SAXContext, c: string) {
    if (NAME_BODY.test(c)) {
        cx.appendMemento(c);
    } else if (isWhitespace(c)) {
        cx.state = 'ATTRIBUTE_NAME_SAW_WHITE';
    } else if (c === '=') {
        newAttribute(cx);
    } else {
        throw new SAXError(c === '>' ? 'Attribute without value' : 'Invalid attribute name', cx);
    }
}

// ATTRIBUTE_NAME_SAW_WHITE; ATTRIBUTE_EQUAL, Error
export function handleAttributeNameSawWhite(cx: SAXContext, c: string) {
    if (c === '=') {
        newAttribute(cx);
    } else if (!isWhitespace(c)) {
        throw new SAXError('Attribute without value', cx);
    }
}

// ATTRIBUTE_EQUAL; ATTRIBUTE_VALUE_START, Error
export function handleAttributeEqual(cx: SAXContext, c: string) {
    // skip whitespace
    if (!isWhitespace(c)) {
        if (c === '"' || c === '\'') {
            cx.quote = c as ('"' | '\'');
            cx.state = 'ATTRIBUTE_VALUE_START';
        } else {
            throw new SAXError('Unquoted attribute value', cx);
        }
    }
}

// ATTRIBUTE_VALUE_START; ATTRIBUTE_VALUE_END
export function handleAttributeValueStart(cx: SAXContext, c: string) {
    if (c === cx.quote) {
        const value = cx.memento;
        cx.clearMemento();
        cx.peekElement()!.peekAttribute()!.value = resolveEntity(value);
        cx.quote = '';
        cx.state = 'ATTRIBUTE_VALUE_END';
    } else {
        cx.appendMemento(c);
    }
}

// ATTRIBUTE_VALUE_END; START_TAG_STUFF, EMPTY_ELEMENT_TAG, start_element & GENERAL_STUFF, Error
export function handleAttributeValueEnd(cx: SAXContext, c: string, emitter: Emittable) {
    if (isWhitespace(c)) {
        cx.state = 'START_TAG_STUFF';
    } else if (c === '/') {
        cx.state = 'EMPTY_ELEMENT_TAG';
    } else if (c === '>') {
        emitStartElement(emitter, cx);
        cx.state = 'GENERAL_STUFF';
    } else {
        throw new SAXError('Invalid attribute name', cx);
    }
}

function closeElement(cx: SAXContext, emitter: Emittable) {
    emitEndElement(emitter, cx, cx.memento);
    cx.clearMemento();
    if (cx.elementLength === 0) {
        emitter.emit('end_document');
        cx.state = 'AFTER_DOCUMENT';
    } else {
        cx.state = 'GENERAL_STUFF';
    }
}

// END_TAG; END_TAG_SAW_WHITE, AFTER_DOCUMENT, GENERAL_STUFF, Error
export function handleEndTag(cx: SAXContext, c: string, emitter: Emittable) {
    if (NAME_BODY.test(c)) {
        cx.appendMemento(c);
    } else if (c === '>') {
        closeElement(cx, emitter);
    } else if (isWhitespace(c)) {
        cx.state = 'END_TAG_SAW_WHITE';
    } else {
        throw new SAXError('Invalid element name', cx);
    }
}

// END_TAG_SAW_WHITE; GENERAL_STUFF, AFTER_DOCUMENT, Error
export function handleEndTagSawWhite(cx: SAXContext, c: string, emitter: Emittable) {
    if (c === '>') {
        closeElement(cx, emitter);
    } else if (!isWhitespace(c)) {
        throw new SAXError('Invalid characters in end-tag', cx);
    }
}

// AFTER_DOCUMENT; Error
export function handleAfterDocument(cx: SAXContext, c: string) {
    if (!isWhitespace(c)) {
        throw new SAXError('Non-whitespace after document.', cx);
    }
}

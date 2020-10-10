import { assertEquals, assertThrows } from 'https://deno.land/std@0.73.0/testing/asserts.ts';
import { ElementInfo, SAXContext } from './context.ts';
import * as handler from './handler.ts';

const DUMMY = {
    emit: () => {},
};

Deno.test('handleBeforeDocument', () => {
    // whitespace
    const cx = new SAXContext();
    handler.handleBeforeDocument(cx, ' ', DUMMY);
    assertEquals(cx.state, 'BEFORE_DOCUMENT');
    // FOUND_LT
    handler.handleBeforeDocument(cx, '<', DUMMY);
    assertEquals(cx.state, 'FOUND_LT');
    // Error
    cx.state = 'BEFORE_DOCUMENT';
    assertThrows(() => handler.handleBeforeDocument(cx, 's', DUMMY));
});

Deno.test('handleGeneralStuff', () => {
    const cx = new SAXContext();
    // whitespace
    cx.state = 'GENERAL_STUFF';
    handler.handleGeneralStuff(cx, ' ');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // FOUND_LT
    handler.handleGeneralStuff(cx, '<');
    assertEquals(cx.state, 'FOUND_LT');
});

Deno.test('handleFoundLT', () => {
    const cx = new SAXContext();
    // PROC_INST
    cx.state = 'FOUND_LT';
    handler.handleFoundLT(cx, '?', DUMMY);
    assertEquals(cx.state, 'PROC_INST');
    // text event & SGML_DECL
    cx.state = 'FOUND_LT';
    cx.appendMemento('test');
    cx.newElement('a');
    let flag = false;
    handler.handleFoundLT(cx, '!', {
        emit: (event, text: string, cdata: boolean, element: ElementInfo) => {
            flag = true;
            assertEquals(event, 'text');
            assertEquals(text, 'test');
            assertEquals(cdata, false);
            assertEquals(element.qName, 'a');
        },
    });
    assertEquals(flag, true);
    assertEquals(cx.state, 'SGML_DECL');
    // START_TAG'
    cx.state = 'FOUND_LT';
    handler.handleFoundLT(cx, 'a', DUMMY);
    assertEquals(cx.state, 'START_TAG');
    assertEquals(cx.memento, 'a');
    // END_TAG
    cx.state = 'FOUND_LT';
    handler.handleFoundLT(cx, '/', DUMMY);
    assertEquals(cx.state, 'END_TAG');
    // Error'
    cx.state = 'FOUND_LT';
    assertThrows(() => handler.handleFoundLT(cx, '-', DUMMY));
});

Deno.test('handleProcInst', () => {
    const cx = new SAXContext();
    // PROC_INST_ENDING
    cx.state = 'PROC_INST';
    handler.handleProcInst(cx, '?');
    assertEquals(cx.state, 'PROC_INST_ENDING');
});

Deno.test('handleProcInstEnding', () => {
    const cx = new SAXContext();
    // processing_instruction & GENERAL_STUFF
    cx.state = 'PROC_INST_ENDING';
    cx.appendMemento('test');
    let flag = false;
    handler.handleProcInstEnding(cx, '>', {
        emit: (event, procInst) => {
            flag = true;
            assertEquals(event, 'processing_instruction');
            assertEquals(procInst, 'test');
        },
    });
    assertEquals(flag, true);
    assertEquals(cx.state, 'GENERAL_STUFF');
    // stay
    cx.state = 'PROC_INST_ENDING';
    cx.appendMemento('test');
    handler.handleProcInstEnding(cx, 'a', DUMMY);
    assertEquals(cx.memento, 'test?a');
});

Deno.test('handleSgmlDecl', () => {
    const cx = new SAXContext();
    // CDATA
    cx.state = 'SGML_DECL';
    cx.appendMemento('[CDATA');
    handler.handleSgmlDecl(cx, '[', DUMMY);
    assertEquals(cx.state, 'CDATA');
    assertEquals(cx.memento, '');
    // COMMENT
    cx.state = 'SGML_DECL';
    cx.appendMemento('-');
    handler.handleSgmlDecl(cx, '-', DUMMY);
    assertEquals(cx.state, 'COMMENT');
    // DOCTYPE
    cx.state = 'SGML_DECL';
    cx.appendMemento('DOCTYP');
    handler.handleSgmlDecl(cx, 'E', DUMMY);
    assertEquals(cx.state, 'DOCTYPE');
    // sgml_declaration & GENERAL_STUFF
    cx.state = 'SGML_DECL';
    cx.appendMemento('test');
    let flag = false;
    handler.handleSgmlDecl(cx, '>', {
        emit: (event, sgml: string) => {
            flag = true;
            assertEquals(event, 'sgml_declaration');
            assertEquals(sgml, 'test');
        },
    });
    assertEquals(flag, true);
    assertEquals(cx.state, 'GENERAL_STUFF');
    assertEquals(cx.memento, '');
    // Error
    cx.state = 'SGML_DECL';
    cx.appendMemento('DOCTYP');
    cx.newElement('a');
    assertThrows(() => handler.handleSgmlDecl(cx, 'E', DUMMY));
});

Deno.test('handleCdata', () => {
    const cx = new SAXContext();
    // CDATA_ENDING
    cx.state = 'CDATA';
    handler.handleCdata(cx, ']');
    assertEquals(cx.state, 'CDATA_ENDING');
});

Deno.test('handleCdataEnding', () => {
    const cx = new SAXContext();
    // CDATA_ENDING2
    cx.state = 'CDATA_ENDING';
    handler.handleCdataEnding(cx, ']');
    assertEquals(cx.state, 'CDATA_ENDING_2');
    // CDATA
    cx.state = 'CDATA_ENDING';
    cx.appendMemento('test');
    handler.handleCdataEnding(cx, 'a');
    assertEquals(cx.state, 'CDATA');
    assertEquals(cx.memento, 'test]a');
});

Deno.test('handleCdataEnding2', () => {
    const cx = new SAXContext();
    // GENERAL_STUFF
    cx.state = 'CDATA_ENDING_2';
    cx.appendMemento('test');
    cx.newElement('a');
    let flag = false;
    handler.handleCdataEnding2(cx, '>', {
        emit: (event, comment: string, cdata: boolean, element: ElementInfo) => {
            flag = true;
            assertEquals(event, 'text');
            assertEquals(comment, 'test');
            assertEquals(cdata, true);
            assertEquals(element.qName, 'a');
        },
    });
    assertEquals(cx.state, 'GENERAL_STUFF');
    assertEquals(flag, true);
    // stay
    cx.state = 'CDATA_ENDING_2';
    cx.appendMemento('test');
    handler.handleCdataEnding2(cx, ']', DUMMY);
    assertEquals(cx.memento, 'test]');
    assertEquals(cx.state, 'CDATA_ENDING_2');
    // CDATA
    handler.handleCdataEnding2(cx, 'a', DUMMY);
    assertEquals(cx.memento, 'test]]]a');
    assertEquals(cx.state, 'CDATA');
});

Deno.test('handleComment', () => {
    const cx = new SAXContext();
    // COMMENT_ENDING
    cx.state = 'COMMENT'
    handler.handleComment(cx, '-');
    assertEquals(cx.state, 'COMMENT_ENDING');
});

Deno.test('handleCommentEnding', () => {
    const cx = new SAXContext();
    // COMMENT_ENDING2
    cx.state = 'COMMENT_ENDING';
    handler.handleCommentEnding(cx, '-');
    assertEquals(cx.state, 'COMMENT_ENDING_2');
    // COMMENT
    cx.state = 'COMMENT_ENDING';
    cx.appendMemento('test');
    handler.handleCommentEnding(cx, 'a');
    assertEquals(cx.state, 'COMMENT');
    assertEquals(cx.memento, 'test-a');
});

Deno.test('handleCommentEnding2', () => {
    const cx = new SAXContext();
    // comment & GENERAL_STUFF
    cx.state = 'COMMENT_ENDING_2';
    cx.appendMemento('test');
    let flag = false;
    handler.handleCommentEnding2(cx, '>', {
        emit: (event, comment: string) => {
            flag = true;
            assertEquals(event, 'comment');
            assertEquals(comment, 'test');
        },
    });
    assertEquals(flag, true);
    assertEquals(cx.state, 'GENERAL_STUFF');
    // COMMENT
    cx.state = 'COMMENT_ENDING_2';
    cx.appendMemento('test');
    handler.handleCommentEnding2(cx, 'a', DUMMY);
    assertEquals(cx.state, 'COMMENT');
    assertEquals(cx.memento, 'test--a');
});

Deno.test('handleDoctype', () => {
    const cx = new SAXContext();
    // doctype & GENERAL_STUFF
    cx.state = 'DOCTYPE';
    cx.appendMemento('tes');
    handler.handleDoctype(cx, 't', DUMMY);
    let flag = false;
    handler.handleDoctype(cx, '>', {
        emit: (event, doctype: string) => {
            flag = true;
            assertEquals(event, 'doctype');
            assertEquals(doctype, 'test');
        },
    });
    assertEquals(flag, true);
    assertEquals(cx.state, 'GENERAL_STUFF');
});

Deno.test('handleStartTag', () => {
    const cx = new SAXContext();
    // start_element & GENERAL_STUFF
    cx.state = 'START_TAG';
    cx.appendMemento('a');
    let flag = false;
    handler.handleStartTag(cx, '>', {
        emit: (event, element: ElementInfo) => {
            flag = true;
            assertEquals(event, 'start_element');
            assertEquals(element.qName, 'a');
        },
    });
    assertEquals(flag, true);
    assertEquals(cx.state, 'GENERAL_STUFF');
    // EMPTY_ELEMENT_TAG
    cx.state = 'START_TAG';
    handler.handleStartTag(cx, '/', DUMMY);
    assertEquals(cx.state, 'EMPTY_ELEMENT_TAG');
    // START_TAG_STUFF
    cx.state = 'START_TAG';
    handler.handleStartTag(cx, ' ', DUMMY);
    assertEquals(cx.state, 'START_TAG_STUFF');
    // Error
    cx.state = 'START_TAG';
    assertThrows(() => handler.handleStartTag(cx, '?', DUMMY));
});

Deno.test('handleStartTagStuff', () => {
    const cx = new SAXContext();
    // start_element & GENERAL_STUFF
    cx.state = 'START_TAG_STUFF';
    cx.newElement('a');
    let flag = false;
    handler.handleStartTagStuff(cx, '>', {
        emit: (event, element: ElementInfo) => {
            flag = true;
            assertEquals(event, 'start_element');
            assertEquals(element.qName, 'a');
        },
    });
    assertEquals(flag, true);
    assertEquals(cx.state, 'GENERAL_STUFF');
    // EMPTY_ELEMENT_TAG
    cx.state = 'START_TAG_STUFF';
    handler.handleStartTagStuff(cx, '/', DUMMY);
    assertEquals(cx.state, 'EMPTY_ELEMENT_TAG');
    // ATTRIBUTE_NAME
    cx.state = 'START_TAG_STUFF';
    handler.handleStartTagStuff(cx, 'a', DUMMY);
    assertEquals(cx.state, 'ATTRIBUTE_NAME');
    assertEquals(cx.memento, 'a');
    // Error
    cx.state = 'START_TAG_STUFF';
    assertThrows(() => handler.handleStartTagStuff(cx, '?', DUMMY));
});

Deno.test('handleEmptyElementTag', () => {
    const cx = new SAXContext();
    // start_element & end_element & GENERAL_STUFF
    cx.state = 'EMPTY_ELEMENT_TAG';
    cx.newElement('test');
    let count = 0;
    let events = '';
    let qNames = '';
    handler.handleEmptyElementTag(cx, '>', {
        emit: (event, element: ElementInfo) => {
            count += 1;
            events += event;
            qNames +=  element.qName;
        },
    });
    assertEquals(count, 2);
    assertEquals(events, 'start_elementend_element');
    assertEquals(qNames, 'testtest');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // Error
    cx.state = 'EMPTY_ELEMENT_TAG';
    assertThrows(() => handler.handleEmptyElementTag(cx, ' ', DUMMY));
});

Deno.test('handleAttributeName', () => {
    const cx = new SAXContext();
    // ATTRIBUTE_NAME_SAW_WHITE
    cx.state = 'ATTRIBUTE_NAME';
    handler.handleAttributeName(cx, ' ');
    assertEquals(cx.state, 'ATTRIBUTE_NAME_SAW_WHITE');
    // ATTRIBUTE_EQUAL
    cx.state = 'ATTRIBUTE_NAME';
    cx.newElement('a');
    cx.appendMemento('test');
    handler.handleAttributeName(cx, '=');
    assertEquals(cx.state, 'ATTRIBUTE_EQUAL');
    assertEquals(cx.peekElement()!.attributes[0].qName, 'test');
    // Error
    cx.state = 'ATTRIBUTE_NAME';
    assertThrows(() => handler.handleAttributeName(cx, '>'));
});

Deno.test('handleAttributeNameSawWhite', () => {
    const cx = new SAXContext();
    // ATTRIBUTE_EQUAL
    cx.state = 'ATTRIBUTE_NAME_SAW_WHITE';
    cx.newElement('a');
    cx.appendMemento('test');
    handler.handleAttributeNameSawWhite(cx, '=');
    assertEquals(cx.state, 'ATTRIBUTE_EQUAL');
    assertEquals(cx.peekElement()!.attributes[0].qName, 'test');
    // Error
    cx.state = 'ATTRIBUTE_NAME_SAW_WHITE';
    assertThrows(() => handler.handleAttributeNameSawWhite(cx, 'a'));
});

Deno.test('handleAttributeEqual', () => {
    const cx = new SAXContext();
    // ATTRIBUTE_VALUE_START
    cx.state = 'ATTRIBUTE_EQUAL';
    handler.handleAttributeEqual(cx, '"');
    assertEquals(cx.state, 'ATTRIBUTE_VALUE_START');
    assertEquals(cx.quote, '"');
    // Error
    cx.state = 'ATTRIBUTE_EQUAL';
    assertThrows(() => handler.handleAttributeEqual(cx, 'a'));
});

Deno.test('handleAttributeValueStart', () => {
    const cx = new SAXContext();
    // ATTRIBUTE_VALUE_END
    cx.state = 'ATTRIBUTE_VALUE_START';
    cx.newElement('a');
    cx.peekElement()!.newAttribute('b');
    cx.quote = '"';
    cx.appendMemento('test');
    handler.handleAttributeValueStart(cx, '"');
    assertEquals(cx.state, 'ATTRIBUTE_VALUE_END');
    assertEquals(cx.peekElement()!.attributes[0].value, 'test');
});

Deno.test('handleAttributeValueEnd', () => {
    const cx = new SAXContext();
    // START_TAG_STUFF
    cx.state = 'ATTRIBUTE_VALUE_END';
    handler.handleAttributeValueEnd(cx, ' ', DUMMY);
    assertEquals(cx.state, 'START_TAG_STUFF');
    // EMPTY_ELEMENT_TAG
    cx.state = 'ATTRIBUTE_VALUE_END';
    handler.handleAttributeValueEnd(cx, '/', DUMMY);
    assertEquals(cx.state, 'EMPTY_ELEMENT_TAG');
    // start_element & GENERAL_STUFF
    cx.state = 'ATTRIBUTE_VALUE_END';
    cx.newElement('a');
    let flag = false;
    handler.handleAttributeValueEnd(cx, '>', {
        emit: (event, element: ElementInfo) => {
            flag = true;
            assertEquals(event, 'start_element');
            assertEquals(element.qName, 'a');
        },
    });
    assertEquals(flag, true);
    assertEquals(cx.state, 'GENERAL_STUFF');
    // Error
    cx.state = 'ATTRIBUTE_VALUE_END';
    assertThrows(() => handler.handleAttributeValueEnd(cx, 'a', DUMMY));
});

Deno.test('handleEndTag', () => {
    const cx = new SAXContext();
    // end_element & GENERAL_STUFF
    cx.state = 'END_TAG';
    cx.newElement('a');
    cx.newElement('test');
    cx.appendMemento('test');
    let flag = false;
    handler.handleEndTag(cx, '>', {
        emit: (event, element: ElementInfo) => {
            flag = true;
            assertEquals(event, 'end_element');
            assertEquals(element.qName, 'test');
        }
    })
    assertEquals(flag, true);
    assertEquals(cx.state, 'GENERAL_STUFF');
    // END_TAG_SAW_WHITE
    cx.state = 'END_TAG';
    handler.handleEndTag(cx, ' ', DUMMY);
    assertEquals(cx.state, 'END_TAG_SAW_WHITE');
    // Error
    cx.state = 'END_TAG';
    assertThrows(() => handler.handleEndTag(cx, '?', DUMMY));
});


Deno.test('handleEndTagSawWhite', () => {
    const cx = new SAXContext();
    // end_element & end_document & AFTER_DOCUMENT
    cx.state = 'END_TAG_SAW_WHITE';
    cx.newElement('test');
    cx.appendMemento('test');
    let events = '';
    handler.handleEndTagSawWhite(cx, '>', {
        emit: (event) => {
            events += event;
        }
    })
    assertEquals(events, 'end_elementend_document');
    assertEquals(cx.state, 'AFTER_DOCUMENT');
    // Error
    cx.state = 'END_TAG';
    assertThrows(() => handler.handleEndTagSawWhite(cx, 'a', DUMMY));
});

Deno.test('handleAfterDocument', () => {
    const cx = new SAXContext();
    // Error
    cx.state = 'AFTER_DOCUMENT';
    assertThrows(() => handler.handleAfterDocument(cx, 'a'));
});
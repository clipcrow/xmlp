import { assertEquals, assertThrows } from 'https://deno.land/std@0.74.0/testing/asserts.ts';
import { SAXContext } from './context.ts';
import * as handler from './handler.ts';

Deno.test('handleBeforeDocument', () => {
    // whitespace
    const cx = new SAXContext();
    handler.handleBeforeDocument(cx, ' ');
    assertEquals(cx.state, 'BEFORE_DOCUMENT');
    // FOUND_LT
    handler.handleBeforeDocument(cx, '<');
    assertEquals(cx.state, 'FOUND_LT');
    // Error
    cx.state = 'BEFORE_DOCUMENT';
    assertThrows(() => handler.handleBeforeDocument(cx, 's'));
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
    handler.handleFoundLT(cx, '?');
    assertEquals(cx.state, 'PROC_INST');
    // text event & SGML_DECL
    cx.state = 'FOUND_LT';
    cx.appendMemento('test');
    cx.newElement('a');
    const [[event, text, cdata, element]] = handler.handleFoundLT(cx, '!');
    assertEquals(event, 'text');
    assertEquals(text, 'test');
    assertEquals(cdata, false);
    assertEquals(element.qName, 'a');
    assertEquals(cx.state, 'SGML_DECL');
    // START_TAG'
    cx.state = 'FOUND_LT';
    handler.handleFoundLT(cx, 'a');
    assertEquals(cx.state, 'START_TAG');
    assertEquals(cx.memento, 'a');
    // END_TAG
    cx.state = 'FOUND_LT';
    handler.handleFoundLT(cx, '/');
    assertEquals(cx.state, 'END_TAG');
    // Error'
    cx.state = 'FOUND_LT';
    assertThrows(() => handler.handleFoundLT(cx, '-'));
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
    const [[event, procInst]] = handler.handleProcInstEnding(cx, '>');
    assertEquals(event, 'processing_instruction');
    assertEquals(procInst, 'test');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // stay
    cx.state = 'PROC_INST_ENDING';
    cx.appendMemento('test');
    handler.handleProcInstEnding(cx, 'a');
    assertEquals(cx.memento, 'test?a');
});

Deno.test('handleSgmlDecl', () => {
    const cx = new SAXContext();
    // CDATA
    cx.state = 'SGML_DECL';
    cx.appendMemento('[CDATA');
    handler.handleSgmlDecl(cx, '[');
    assertEquals(cx.state, 'CDATA');
    assertEquals(cx.memento, '');
    // COMMENT
    cx.state = 'SGML_DECL';
    cx.appendMemento('-');
    handler.handleSgmlDecl(cx, '-');
    assertEquals(cx.state, 'COMMENT');
    // DOCTYPE
    cx.state = 'SGML_DECL';
    cx.appendMemento('DOCTYP');
    handler.handleSgmlDecl(cx, 'E');
    assertEquals(cx.state, 'DOCTYPE');
    // sgml_declaration & GENERAL_STUFF
    cx.state = 'SGML_DECL';
    cx.appendMemento('test');
    const [[event, sgml]] = handler.handleSgmlDecl(cx, '>');
    assertEquals(event, 'sgml_declaration');
    assertEquals(sgml, 'test');
    assertEquals(cx.state, 'GENERAL_STUFF');
    assertEquals(cx.memento, '');
    // Error
    cx.state = 'SGML_DECL';
    cx.appendMemento('DOCTYP');
    cx.newElement('a');
    assertThrows(() => handler.handleSgmlDecl(cx, 'E'));
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
    const [[event, text, cdata, element]] = handler.handleCdataEnding2(cx, '>');
    assertEquals(event, 'text');
    assertEquals(text, 'test');
    assertEquals(cdata, true);
    assertEquals(element.qName, 'a');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // stay
    cx.state = 'CDATA_ENDING_2';
    cx.appendMemento('test');
    handler.handleCdataEnding2(cx, ']');
    assertEquals(cx.memento, 'test]');
    assertEquals(cx.state, 'CDATA_ENDING_2');
    // CDATA
    handler.handleCdataEnding2(cx, 'a');
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
    const [[event, comment]] = handler.handleCommentEnding2(cx, '>');
    assertEquals(event, 'comment');
    assertEquals(comment, 'test');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // COMMENT
    cx.state = 'COMMENT_ENDING_2';
    cx.appendMemento('test');
    handler.handleCommentEnding2(cx, 'a');
    assertEquals(cx.state, 'COMMENT');
    assertEquals(cx.memento, 'test--a');
});

Deno.test('handleDoctype', () => {
    const cx = new SAXContext();
    // doctype & GENERAL_STUFF
    cx.state = 'DOCTYPE';
    cx.appendMemento('tes');
    handler.handleDoctype(cx, 't');
    const [[event, doctype]] = handler.handleDoctype(cx, '>');
    assertEquals(event, 'doctype');
    assertEquals(doctype, 'test');
    assertEquals(cx.state, 'GENERAL_STUFF');
});

Deno.test('handleStartTag', () => {
    const cx = new SAXContext();
    // start_element & GENERAL_STUFF
    cx.state = 'START_TAG';
    cx.appendMemento('a');
    const [[event, element]] = handler.handleStartTag(cx, '>');
    assertEquals(event, 'start_element');
    assertEquals(element.qName, 'a');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // EMPTY_ELEMENT_TAG
    cx.state = 'START_TAG';
    handler.handleStartTag(cx, '/');
    assertEquals(cx.state, 'EMPTY_ELEMENT_TAG');
    // START_TAG_STUFF
    cx.state = 'START_TAG';
    handler.handleStartTag(cx, ' ');
    assertEquals(cx.state, 'START_TAG_STUFF');
    // Error
    cx.state = 'START_TAG';
    assertThrows(() => handler.handleStartTag(cx, '?'));
});

Deno.test('handleStartTagStuff', () => {
    const cx = new SAXContext();
    // start_element & GENERAL_STUFF
    cx.state = 'START_TAG_STUFF';
    cx.newElement('a');
    const [[event, element]] = handler.handleStartTagStuff(cx, '>');
    assertEquals(event, 'start_element');
    assertEquals(element.qName, 'a');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // EMPTY_ELEMENT_TAG
    cx.state = 'START_TAG_STUFF';
    handler.handleStartTagStuff(cx, '/');
    assertEquals(cx.state, 'EMPTY_ELEMENT_TAG');
    // ATTRIBUTE_NAME
    cx.state = 'START_TAG_STUFF';
    handler.handleStartTagStuff(cx, 'a');
    assertEquals(cx.state, 'ATTRIBUTE_NAME');
    assertEquals(cx.memento, 'a');
    // Error
    cx.state = 'START_TAG_STUFF';
    assertThrows(() => handler.handleStartTagStuff(cx, '?'));
});

Deno.test('handleEmptyElementTag', () => {
    const cx = new SAXContext();
    // start_element & end_element & GENERAL_STUFF
    cx.state = 'EMPTY_ELEMENT_TAG';
    cx.newElement('test');
    const [[event0, element0], [event1, element1]] = handler.handleEmptyElementTag(cx, '>');
    assertEquals(event0, 'start_element');
    assertEquals(element0.qName, 'test');
    assertEquals(event1, 'end_element');
    assertEquals(element1.qName, 'test');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // Error
    cx.state = 'EMPTY_ELEMENT_TAG';
    assertThrows(() => handler.handleEmptyElementTag(cx, ' '));
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
    handler.handleAttributeValueEnd(cx, ' ');
    assertEquals(cx.state, 'START_TAG_STUFF');
    // EMPTY_ELEMENT_TAG
    cx.state = 'ATTRIBUTE_VALUE_END';
    handler.handleAttributeValueEnd(cx, '/');
    assertEquals(cx.state, 'EMPTY_ELEMENT_TAG');
    // start_element & GENERAL_STUFF
    cx.state = 'ATTRIBUTE_VALUE_END';
    cx.newElement('a');
    const [[event, element]] = handler.handleAttributeValueEnd(cx, '>');
    assertEquals(event, 'start_element');
    assertEquals(element.qName, 'a');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // Error
    cx.state = 'ATTRIBUTE_VALUE_END';
    assertThrows(() => handler.handleAttributeValueEnd(cx, 'a'));
});

Deno.test('handleEndTag', () => {
    const cx = new SAXContext();
    // end_element & GENERAL_STUFF
    cx.state = 'END_TAG';
    cx.newElement('a');
    cx.newElement('test');
    cx.appendMemento('test');
    const [[event, element]] = handler.handleEndTag(cx, '>');
    assertEquals(event, 'end_element');
    assertEquals(element.qName, 'test');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // END_TAG_SAW_WHITE
    cx.state = 'END_TAG';
    handler.handleEndTag(cx, ' ');
    assertEquals(cx.state, 'END_TAG_SAW_WHITE');
    // Error
    cx.state = 'END_TAG';
    assertThrows(() => handler.handleEndTag(cx, '?'));
});


Deno.test('handleEndTagSawWhite', () => {
    const cx = new SAXContext();
    // end_element & end_document & AFTER_DOCUMENT
    cx.state = 'END_TAG_SAW_WHITE';
    cx.newElement('test');
    cx.appendMemento('test');
    const [[event0], [event1]] = handler.handleEndTagSawWhite(cx, '>');
    assertEquals(event0, 'end_element');
    assertEquals(event1, 'end_document');
    assertEquals(cx.state, 'AFTER_DOCUMENT');
    // Error
    cx.state = 'END_TAG';
    assertThrows(() => handler.handleEndTagSawWhite(cx, 'a'));
});

Deno.test('handleAfterDocument', () => {
    const cx = new SAXContext();
    // Error
    cx.state = 'AFTER_DOCUMENT';
    assertThrows(() => handler.handleAfterDocument(cx, 'a'));
});

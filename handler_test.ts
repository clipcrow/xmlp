// Copyright 2020 Masataka Kurihara. All rights reserved. MIT license.

import {
    assertEquals,
    assertThrows,
} from './deps.ts';

import {
    XMLParseContext,
} from './context.ts';

import {
    resolveEntity,
    handleBeforeDocument,
    handleGeneralStuff,
    handleFoundLT,
    handleProcInst,
    handleProcInstEnding,
    handleSgmlDecl,
    handleCdata,
    handleCdataEnding,
    handleCdataEnding2,
    handleComment,
    handleCommentEnding,
    handleCommentEnding2,
    handleDoctype,
    handleStartTag,
    handleStartTagStuff,
    handleEmptyElementTag,
    handleAttributeName,
    handleAttributeNameSawWhite,
    handleAttributeEqual,
    handleAttributeValueStart,
    handleAttributeValueEnd,
    handleEndTag,
    handleEndTagSawWhite,
    handleAfterDocument,
} from './handler.ts';

Deno.test('resolveEntity', () => {
    assertEquals(resolveEntity('a&amp;b'), 'a&b');
    assertEquals(resolveEntity('a&lt;b&gt;'), 'a<b>');
    assertEquals(resolveEntity('&quot;ab&quot;'), '"ab"');
    assertEquals(resolveEntity('&apos;ab&apos;'), '\'ab\'');
});

Deno.test('handleBeforeDocument', () => {
    // whitespace
    const cx = new XMLParseContext();
    handleBeforeDocument(cx, ' ');
    assertEquals(cx.state, 'BEFORE_DOCUMENT');
    // FOUND_LT
    handleBeforeDocument(cx, '<');
    assertEquals(cx.state, 'FOUND_LT');
    // Error
    cx.state = 'BEFORE_DOCUMENT';
    assertThrows(() => handleBeforeDocument(cx, 's'));
});

Deno.test('handleGeneralStuff', () => {
    const cx = new XMLParseContext();
    // text including whitespace
    cx.state = 'GENERAL_STUFF';
    cx.newElement('a');
    handleGeneralStuff(cx, 'a');
    handleGeneralStuff(cx, ' ');
    handleGeneralStuff(cx, 'b');
    assertEquals(cx.state, 'GENERAL_STUFF');
    assertEquals(cx.memento, 'a b');
    // FOUND_LT
    handleGeneralStuff(cx, '<');
    assertEquals(cx.state, 'FOUND_LT');
});

Deno.test('handleFoundLT', () => {
    const cx = new XMLParseContext();
    // PROC_INST
    cx.state = 'FOUND_LT';
    handleFoundLT(cx, '?');
    assertEquals(cx.state, 'PROC_INST');
    // text event & SGML_DECL
    cx.state = 'FOUND_LT';
    cx.appendMemento('test');
    cx.newElement('a');
    const [[event, text, element, cdata]] = handleFoundLT(cx, '!');
    assertEquals(event, 'text');
    assertEquals(text, 'test');
    assertEquals(element.qName, 'a');
    assertEquals(cdata, false);
    assertEquals(cx.state, 'SGML_DECL');
    // START_TAG'
    cx.state = 'FOUND_LT';
    handleFoundLT(cx, 'a');
    assertEquals(cx.state, 'START_TAG');
    assertEquals(cx.memento, 'a');
    // END_TAG
    cx.state = 'FOUND_LT';
    handleFoundLT(cx, '/');
    assertEquals(cx.state, 'END_TAG');
    // Error'
    cx.state = 'FOUND_LT';
    assertThrows(() => handleFoundLT(cx, '-'));
});

Deno.test('handleProcInst', () => {
    const cx = new XMLParseContext();
    // PROC_INST_ENDING
    cx.state = 'PROC_INST';
    handleProcInst(cx, '?');
    assertEquals(cx.state, 'PROC_INST_ENDING');
});

Deno.test('handleProcInstEnding', () => {
    const cx = new XMLParseContext();
    // processing_instruction & BEFORE_DOCUMENT
    cx.state = 'PROC_INST_ENDING';
    cx.appendMemento('test');
    const [[event, procInst]] = handleProcInstEnding(cx, '>');
    assertEquals(event, 'processing_instruction');
    assertEquals(procInst, 'test');
    assertEquals(cx.state, 'BEFORE_DOCUMENT');
    // stay
    cx.state = 'PROC_INST_ENDING';
    cx.appendMemento('test');
    handleProcInstEnding(cx, 'a');
    assertEquals(cx.memento, 'test?a');
});

Deno.test('handleSgmlDecl', () => {
    const cx = new XMLParseContext();
    // CDATA
    cx.state = 'SGML_DECL';
    cx.appendMemento('[CDATA');
    handleSgmlDecl(cx, '[');
    assertEquals(cx.state, 'CDATA');
    assertEquals(cx.memento, '');
    // COMMENT
    cx.state = 'SGML_DECL';
    cx.appendMemento('-');
    handleSgmlDecl(cx, '-');
    assertEquals(cx.state, 'COMMENT');
    // DOCTYPE
    cx.state = 'SGML_DECL';
    cx.appendMemento('DOCTYP');
    handleSgmlDecl(cx, 'E');
    assertEquals(cx.state, 'DOCTYPE');
    // sgml_declaration & BEFORE_DOCUMENT
    cx.state = 'SGML_DECL';
    cx.appendMemento('test');
    const [[event, sgml]] = handleSgmlDecl(cx, '>');
    assertEquals(event, 'sgml_declaration');
    assertEquals(sgml, 'test');
    assertEquals(cx.state, 'BEFORE_DOCUMENT');
    assertEquals(cx.memento, '');
    // Error
    cx.state = 'SGML_DECL';
    cx.appendMemento('DOCTYP');
    cx.newElement('a');
    assertThrows(() => handleSgmlDecl(cx, 'E'));
});

Deno.test('handleCdata', () => {
    const cx = new XMLParseContext();
    // CDATA_ENDING
    cx.state = 'CDATA';
    handleCdata(cx, ']');
    assertEquals(cx.state, 'CDATA_ENDING');
});

Deno.test('handleCdataEnding', () => {
    const cx = new XMLParseContext();
    // CDATA_ENDING2
    cx.state = 'CDATA_ENDING';
    handleCdataEnding(cx, ']');
    assertEquals(cx.state, 'CDATA_ENDING_2');
    // CDATA
    cx.state = 'CDATA_ENDING';
    cx.appendMemento('test');
    handleCdataEnding(cx, 'a');
    assertEquals(cx.state, 'CDATA');
    assertEquals(cx.memento, 'test]a');
});

Deno.test('handleCdataEnding2', () => {
    const cx = new XMLParseContext();
    // GENERAL_STUFF
    cx.state = 'CDATA_ENDING_2';
    cx.appendMemento('test');
    cx.newElement('a');
    const [[event, text, element, cdata]] = handleCdataEnding2(cx, '>');
    assertEquals(event, 'text');
    assertEquals(text, 'test');
    assertEquals(element.qName, 'a');
    assertEquals(cdata, true);
    assertEquals(cx.state, 'GENERAL_STUFF');
    // stay
    cx.state = 'CDATA_ENDING_2';
    cx.appendMemento('test');
    handleCdataEnding2(cx, ']');
    assertEquals(cx.memento, 'test]');
    assertEquals(cx.state, 'CDATA_ENDING_2');
    // CDATA
    handleCdataEnding2(cx, 'a');
    assertEquals(cx.memento, 'test]]]a');
    assertEquals(cx.state, 'CDATA');
});

Deno.test('handleComment', () => {
    const cx = new XMLParseContext();
    // COMMENT_ENDING
    cx.state = 'COMMENT'
    handleComment(cx, '-');
    assertEquals(cx.state, 'COMMENT_ENDING');
});

Deno.test('handleCommentEnding', () => {
    const cx = new XMLParseContext();
    // COMMENT_ENDING2
    cx.state = 'COMMENT_ENDING';
    handleCommentEnding(cx, '-');
    assertEquals(cx.state, 'COMMENT_ENDING_2');
    // COMMENT
    cx.state = 'COMMENT_ENDING';
    cx.appendMemento('test');
    handleCommentEnding(cx, 'a');
    assertEquals(cx.state, 'COMMENT');
    assertEquals(cx.memento, 'test-a');
});

Deno.test('handleCommentEnding2', () => {
    const cx = new XMLParseContext();
    // comment & GENERAL_STUFF
    cx.state = 'COMMENT_ENDING_2';
    cx.appendMemento('test');
    const [[event, comment]] = handleCommentEnding2(cx, '>');
    assertEquals(event, 'comment');
    assertEquals(comment, 'test');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // COMMENT
    cx.state = 'COMMENT_ENDING_2';
    cx.appendMemento('test');
    handleCommentEnding2(cx, 'a');
    assertEquals(cx.state, 'COMMENT');
    assertEquals(cx.memento, 'test--a');
});

Deno.test('handleDoctype', () => {
    const cx = new XMLParseContext();
    // doctype & BEFORE_DOCUMENT
    cx.state = 'DOCTYPE';
    cx.appendMemento('tes');
    handleDoctype(cx, 't');
    const [[event, doctype]] = handleDoctype(cx, '>');
    assertEquals(event, 'doctype');
    assertEquals(doctype, 'test');
    assertEquals(cx.state, 'BEFORE_DOCUMENT');
});

Deno.test('handleStartTag', () => {
    const cx = new XMLParseContext();
    // start_element & GENERAL_STUFF
    cx.newElement('root');
    cx.state = 'START_TAG';
    cx.appendMemento('a');
    const [[event, element]] = handleStartTag(cx, '>');
    assertEquals(event, 'start_element');
    assertEquals(element.qName, 'a');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // EMPTY_ELEMENT_TAG
    cx.state = 'START_TAG';
    handleStartTag(cx, '/');
    assertEquals(cx.state, 'EMPTY_ELEMENT_TAG');
    // START_TAG_STUFF
    cx.state = 'START_TAG';
    handleStartTag(cx, ' ');
    assertEquals(cx.state, 'START_TAG_STUFF');
    // Error
    cx.state = 'START_TAG';
    assertThrows(() => handleStartTag(cx, '?'));
});

Deno.test('handleStartTagStuff', () => {
    const cx = new XMLParseContext();
    // start_element & GENERAL_STUFF
    cx.newElement('root');
    cx.state = 'START_TAG_STUFF';
    cx.newElement('a');
    const [[event, element]] = handleStartTagStuff(cx, '>');
    assertEquals(event, 'start_element');
    assertEquals(element.qName, 'a');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // EMPTY_ELEMENT_TAG
    cx.state = 'START_TAG_STUFF';
    handleStartTagStuff(cx, '/');
    assertEquals(cx.state, 'EMPTY_ELEMENT_TAG');
    // ATTRIBUTE_NAME
    cx.state = 'START_TAG_STUFF';
    handleStartTagStuff(cx, 'a');
    assertEquals(cx.state, 'ATTRIBUTE_NAME');
    assertEquals(cx.memento, 'a');
    // Error
    cx.state = 'START_TAG_STUFF';
    assertThrows(() => handleStartTagStuff(cx, '?'));
});

Deno.test('handleEmptyElementTag', () => {
    const cx = new XMLParseContext();
    // start_element & end_element & GENERAL_STUFF
    cx.newElement('root');
    cx.state = 'EMPTY_ELEMENT_TAG';
    cx.newElement('test');
    const [[event0, element0], [event1, element1]] = handleEmptyElementTag(cx, '>');
    assertEquals(event0, 'start_element');
    assertEquals(element0.qName, 'test');
    assertEquals(event1, 'end_element');
    assertEquals(element1.qName, 'test');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // Error
    cx.state = 'EMPTY_ELEMENT_TAG';
    assertThrows(() => handleEmptyElementTag(cx, ' '));
});

Deno.test('handleAttributeName', () => {
    const cx = new XMLParseContext();
    // ATTRIBUTE_NAME_SAW_WHITE
    cx.state = 'ATTRIBUTE_NAME';
    handleAttributeName(cx, ' ');
    assertEquals(cx.state, 'ATTRIBUTE_NAME_SAW_WHITE');
    // ATTRIBUTE_EQUAL
    cx.state = 'ATTRIBUTE_NAME';
    cx.newElement('a');
    cx.appendMemento('test');
    handleAttributeName(cx, '=');
    assertEquals(cx.state, 'ATTRIBUTE_EQUAL');
    assertEquals(cx.peekElement()!.attributes[0].qName, 'test');
    // Error
    cx.state = 'ATTRIBUTE_NAME';
    assertThrows(() => handleAttributeName(cx, '>'));
});

Deno.test('handleAttributeNameSawWhite', () => {
    const cx = new XMLParseContext();
    // ATTRIBUTE_EQUAL
    cx.state = 'ATTRIBUTE_NAME_SAW_WHITE';
    cx.newElement('a');
    cx.appendMemento('test');
    handleAttributeNameSawWhite(cx, '=');
    assertEquals(cx.state, 'ATTRIBUTE_EQUAL');
    assertEquals(cx.peekElement()!.attributes[0].qName, 'test');
    // Error
    cx.state = 'ATTRIBUTE_NAME_SAW_WHITE';
    assertThrows(() => handleAttributeNameSawWhite(cx, 'a'));
});

Deno.test('handleAttributeEqual', () => {
    const cx = new XMLParseContext();
    // ATTRIBUTE_VALUE_START
    cx.state = 'ATTRIBUTE_EQUAL';
    handleAttributeEqual(cx, '"');
    assertEquals(cx.state, 'ATTRIBUTE_VALUE_START');
    assertEquals(cx.quote, '"');
    // Error
    cx.state = 'ATTRIBUTE_EQUAL';
    assertThrows(() => handleAttributeEqual(cx, 'a'));
});

Deno.test('handleAttributeValueStart', () => {
    const cx = new XMLParseContext();
    // ATTRIBUTE_VALUE_END
    cx.newElement('root');
    cx.state = 'ATTRIBUTE_VALUE_START';
    cx.newElement('a');
    cx.peekElement()!.newAttribute('b');
    cx.quote = '"';
    cx.appendMemento('test');
    handleAttributeValueStart(cx, '"');
    assertEquals(cx.state, 'ATTRIBUTE_VALUE_END');
    assertEquals(cx.peekElement()!.attributes[0].value, 'test');
});

Deno.test('handleAttributeValueEnd', () => {
    const cx = new XMLParseContext();
    // START_TAG_STUFF
    cx.state = 'ATTRIBUTE_VALUE_END';
    handleAttributeValueEnd(cx, ' ');
    assertEquals(cx.state, 'START_TAG_STUFF');
    // EMPTY_ELEMENT_TAG
    cx.state = 'ATTRIBUTE_VALUE_END';
    handleAttributeValueEnd(cx, '/');
    assertEquals(cx.state, 'EMPTY_ELEMENT_TAG');
    // start_element & GENERAL_STUFF
    cx.newElement('root');
    cx.state = 'ATTRIBUTE_VALUE_END';
    cx.newElement('a');
    const [[event, element]] = handleAttributeValueEnd(cx, '>');
    assertEquals(event, 'start_element');
    assertEquals(element.qName, 'a');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // Error
    cx.state = 'ATTRIBUTE_VALUE_END';
    assertThrows(() => handleAttributeValueEnd(cx, 'a'));
});

Deno.test('handleEndTag', () => {
    const cx = new XMLParseContext();
    // end_element & GENERAL_STUFF
    cx.state = 'END_TAG';
    cx.newElement('a');
    cx.newElement('test');
    cx.appendMemento('test');
    const [[event, element]] = handleEndTag(cx, '>');
    assertEquals(event, 'end_element');
    assertEquals(element.qName, 'test');
    assertEquals(cx.state, 'GENERAL_STUFF');
    // END_TAG_SAW_WHITE
    cx.state = 'END_TAG';
    handleEndTag(cx, ' ');
    assertEquals(cx.state, 'END_TAG_SAW_WHITE');
    // Error
    cx.state = 'END_TAG';
    assertThrows(() => handleEndTag(cx, '?'));
});


Deno.test('handleEndTagSawWhite', () => {
    const cx = new XMLParseContext();
    // end_element & end_document & AFTER_DOCUMENT
    cx.state = 'END_TAG_SAW_WHITE';
    cx.newElement('test');
    cx.appendMemento('test');
    const [[event0], [event1]] = handleEndTagSawWhite(cx, '>');
    assertEquals(event0, 'end_element');
    assertEquals(event1, 'end_document');
    assertEquals(cx.state, 'AFTER_DOCUMENT');
    // Error
    cx.state = 'END_TAG';
    assertThrows(() => handleEndTagSawWhite(cx, 'a'));
});

Deno.test('handleAfterDocument', () => {
    const cx = new XMLParseContext();
    // Error
    cx.state = 'AFTER_DOCUMENT';
    assertThrows(() => handleAfterDocument(cx, 'a'));
});

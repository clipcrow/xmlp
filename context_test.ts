// Copyright 2020 Masataka Kurihara. All rights reserved. MIT license.

import {
    assertEquals,
} from './dev_deps.ts';

import {
    Attribute,
    AttributeInfo,
    Element,
    ElementInfo,
    XMLParseContext,
} from './context.ts';

Deno.test('Attribute xmlns', () => {
    const attribute = new Attribute('xmlns');
    attribute.value = 'https://xmlp.test/xmlns';
    assertEquals(attribute.qName, 'xmlns');
    assertEquals(attribute.prefix, 'xmlns');
    assertEquals(attribute.localPart, '');
    assertEquals(attribute.value, 'https://xmlp.test/xmlns');
});

Deno.test('Element QName', () => {
    const element = new Element('a:b');
    assertEquals(element.qName, 'a:b');
    assertEquals(element.prefix, 'a');
    assertEquals(element.localPart, 'b');
});

Deno.test('Element newAttribute & peekAttribute & attributes & prefixMappings', () => {
    const element = new Element('a');
    element.newAttribute('b');
    element.newAttribute('xmlns');
    element.peekAttribute()!.value = 'https://xmlp.test/xmlns';
    element.newAttribute('xmlns:a');
    element.peekAttribute()!.value = 'https://xmlp.test/xmlns/a';
    const attributes = element.attributes;
    assertEquals(attributes[0].qName, 'b');
    assertEquals(attributes[1].qName, 'xmlns');
    assertEquals(attributes[2].qName, 'xmlns:a');
    assertEquals(
        element.prefixMappings,
        [{ ns: '', uri: 'https://xmlp.test/xmlns' }, { ns: 'a', uri: 'https://xmlp.test/xmlns/a' }],
    );
});

Deno.test('AttributeInfo', () => {
    const attribute = new Attribute('xmlns');
    attribute.uri = 'https://xmlp.test/xmlns';
    attribute.value = 'https://xmlp.test/xmlns';
    const attributeInfo = new AttributeInfo(attribute);
    assertEquals(attributeInfo.qName, 'xmlns');
    assertEquals(attributeInfo.prefix, 'xmlns');
    assertEquals(attributeInfo.localPart, '');
    assertEquals(attributeInfo.uri, 'https://xmlp.test/xmlns');
    assertEquals(attributeInfo.value, 'https://xmlp.test/xmlns');
});

Deno.test('ElementInfo', () => {
    const parent = new Element('parent');
    const element = new Element('a:b', parent);
    element.newAttribute('c');
    element.uri = 'https://xmlp.test/xmlns/a';
    element.emptyElement = true;
    const elementInfo = new ElementInfo(element);
    assertEquals(elementInfo.qName, 'a:b');
    assertEquals(elementInfo.prefix, 'a');
    assertEquals(elementInfo.localPart, 'b');
    assertEquals(elementInfo.uri, 'https://xmlp.test/xmlns/a');
    assertEquals(elementInfo.parent!.qName, 'parent');
    assertEquals(elementInfo.attributes[0].qName, 'c');
    assertEquals(elementInfo.emptyElement, true);
});

Deno.test('XMLParseContext memento & appendMemento & clearMemento', () => {
    const cx = new XMLParseContext();
    cx.appendMemento('a');
    cx.appendMemento('b');
    assertEquals(cx.memento, 'ab');
    cx.clearMemento();
    assertEquals(cx.memento, '');
});

Deno.test('XMLParseContext newElement & peekElement & popElement & elementLength', () => {
    const cx = new XMLParseContext();
    cx.newElement('a');
    assertEquals(cx.peekElement()!.qName, 'a');
    assertEquals(cx.elementLength, 1);
    cx.newElement('b');
    assertEquals(cx.elementLength, 2);
    assertEquals(cx.popElement()!.qName, 'b');
    assertEquals(cx.elementLength, 1);
});

Deno.test('XMLParseContext registerNamespace & getNamespaceURI', () => {
    const cx = new XMLParseContext();
    cx.registerNamespace('a', 'https://xmlp.test/xmlns/a');
    assertEquals(cx.getNamespaceURI('a'), 'https://xmlp.test/xmlns/a');
});

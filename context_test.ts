import { assertEquals } from 'https://deno.land/std@0.73.0/testing/asserts.ts';
import { Attribute, AttributeInfo, Element, ElementInfo, SAXContext } from './context.ts';

Deno.test('Attribute xmlns', () => {
    const attribute = new Attribute('xmlns');
    attribute.value = 'https://saxp.test/xmlns';
    assertEquals(attribute.qName, 'xmlns');
    assertEquals(attribute.prefix, 'xmlns');
    assertEquals(attribute.localPart, '');
    assertEquals(attribute.value, 'https://saxp.test/xmlns');
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
    element.peekAttribute()!.value = 'https://saxp.test/xmlns';
    element.newAttribute('xmlns:a');
    element.peekAttribute()!.value = 'https://saxp.test/xmlns/a';
    const attributes = element.attributes;
    assertEquals(attributes[0].qName, 'b');
    assertEquals(attributes[1].qName, 'xmlns');
    assertEquals(attributes[2].qName, 'xmlns:a');
    assertEquals(
        element.prefixMappings,
        [{ ns: '', uri: 'https://saxp.test/xmlns' }, { ns: 'a', uri: 'https://saxp.test/xmlns/a' }],
    );
});

Deno.test('AttributeInfo', () => {
    const attribute = new Attribute('xmlns');
    attribute.uri = 'https://saxp.test/xmlns';
    attribute.value = 'https://saxp.test/xmlns';
    const attributeInfo = new AttributeInfo(attribute);
    assertEquals(attributeInfo.qName, 'xmlns');
    assertEquals(attributeInfo.prefix, 'xmlns');
    assertEquals(attributeInfo.localPart, '');
    assertEquals(attributeInfo.uri, 'https://saxp.test/xmlns');
    assertEquals(attributeInfo.value, 'https://saxp.test/xmlns');
});

Deno.test('ElementInfo', () => {
    const parent = new Element('parent');
    const element = new Element('a:b', parent);
    element.newAttribute('c');
    element.uri = 'https://saxp.test/xmlns/a';
    element.standAlone = true;
    const elementInfo = new ElementInfo(element);
    assertEquals(elementInfo.qName, 'a:b');
    assertEquals(elementInfo.prefix, 'a');
    assertEquals(elementInfo.localPart, 'b');
    assertEquals(elementInfo.uri, 'https://saxp.test/xmlns/a');
    assertEquals(elementInfo.parent!.qName, 'parent');
    assertEquals(elementInfo.attributes[0].qName, 'c');
    assertEquals(elementInfo.standAlone, true);
});

Deno.test('SAXContext memento & appendMemento & clearMemento', () => {
    const cx = new SAXContext();
    cx.appendMemento('a');
    cx.appendMemento('b');
    assertEquals(cx.memento, 'ab');
    cx.clearMemento();
    assertEquals(cx.memento, '');
});

Deno.test('SAXContext newElement & peekElement & popElement & elementLength', () => {
    const cx = new SAXContext();
    cx.newElement('a');
    assertEquals(cx.peekElement()!.qName, 'a');
    assertEquals(cx.elementLength, 1);
    cx.newElement('b');
    assertEquals(cx.elementLength, 2);
    assertEquals(cx.popElement()!.qName, 'b');
    assertEquals(cx.elementLength, 1);
});

Deno.test('SAXContext registerNamespace & getNamespaceURI', () => {
    const cx = new SAXContext();
    cx.registerNamespace('a', 'https://saxp.test/xmlns/a');
    assertEquals(cx.getNamespaceURI('a'), 'https://saxp.test/xmlns/a');
});

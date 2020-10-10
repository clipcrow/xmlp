class QName {
    private _qName: string;
    protected _prefix: string;
    protected _localPart: string;

    constructor(qName: string) {
        this._qName = qName;
        const i = qName.indexOf(':');
        const q = i < 0 ? [ '', qName ] : qName.split(':');
        this._prefix = q[0];
        this._localPart = q[1];
    }

    get qName(): string {
        return this._qName;
    }

    get prefix(): string {
        return this._prefix;
    }

    get localPart(): string {
        return this._localPart;
    }
}

export class Attribute extends QName {
    uri?: string;
    value = '';

    constructor(qName: string) {
        super(qName);
        if (qName === 'xmlns') {
            this._prefix = 'xmlns';
            this._localPart = '';
        }
    }
}

export class Element extends QName {
    private _attributes: Attribute[] = [];
    private _parent?: Element;

    uri?: string;
    standAlone = false;

    constructor(name: string, parent?: Element) {
        super(name);
        this._parent = parent;
    }

    get parent(): Element | undefined {
        return this._parent;
    }

    newAttribute(qName: string) {
        const attribute = new Attribute(qName);
        this._attributes.push(attribute);
    }

    peekAttribute(): Attribute | undefined {
        const i = this._attributes.length - 1;
        if (i < 0) {
            return undefined;
        }
        return this._attributes[i];
    }

    get attributes(): Attribute[] {
        return this._attributes;
    }

    get prefixMappings(): { ns: string, uri: string }[] {
        const filterd = this._attributes.filter((attr) => (attr.prefix === 'xmlns'));
        return filterd.map((attr) => ({ ns: attr.localPart, uri: attr.value }));
    }
}

// read only Attribute
export class AttributeInfo extends QName {
    private _attribute: Attribute;

    constructor(attribute: Attribute) {
        super(attribute.qName);
        if (attribute.qName === 'xmlns') {
            this._prefix = 'xmlns';
            this._localPart = '';
        }
        this._attribute = attribute;
    }

    get uri(): string | undefined {
        return this._attribute.uri;
    }

    get value(): string {
        return this._attribute.value;
    }
}

// read only Element
export class ElementInfo extends QName {
    private _element: Element;

    constructor(element: Element) {
        super(element.qName);
        this._element = element;
    }

    get uri(): string | undefined {
        return this._element.uri;
    }

    get parent(): ElementInfo | undefined {
        const parent = this._element.parent;
        if (parent) {
            return new ElementInfo(parent);
        }
        return undefined;
    }

    get attributes(): AttributeInfo[] {
        return this._element.attributes.map((attribute) => {
            return new AttributeInfo(attribute);
        });
    }

    get prefixMappings(): { ns: string, uri: string }[] {
        return this._element.prefixMappings;
    }

    get standAlone(): boolean {
        return this._element.standAlone;
    }
}

export type SAXPosition = { line: number, column: number };

export interface Locatable {
    position: SAXPosition;
}

export class SAXContext {
    private _locator?: Locatable;
    private _memento = '';
    private _elementStack: Element[] = [];
    private _namespaces: { [ns: string]: string | undefined } = {};

    quote: '' | '"' | '\'' = '';
    state = 'BEFORE_DOCUMENT';

    constructor(locator?: Locatable) {
        this._locator = locator;
    }

    get position(): SAXPosition {
        return this._locator?.position || { line: -1, column: -1 };
    }

    appendMemento(value: string) {
        this._memento += value;
    }

    clearMemento() {
        this._memento = '';
    }

    get memento(): string {
        return this._memento;
    }

    newElement(qName: string) {
        const parent = this.peekElement();
        this._elementStack.push(new Element(qName, parent));
    }

    peekElement(): Element | undefined {
        return this._elementStack[this._elementStack.length - 1];
    }

    popElement(): Element | undefined {
        const element = this._elementStack.pop();
        element?.prefixMappings.forEach(({ns}) => {
            this._namespaces[ns] = undefined;
        })
        return element;
    }

    get elementLength(): number {
        return this._elementStack.length;
    }

    registerNamespace(ns: string, uri: string) {
        this._namespaces[ns] = uri;
    }

    getNamespaceURI(ns: string): string | undefined {
        return this._namespaces[ns];
    }
}

export interface Emittable {
    // deno-lint-ignore no-explicit-any
    emit(event: string, ...args: any[]): void;
}

export interface SAXHandler {
    (cx: SAXContext, c: string, emitter: Emittable): void;
}

export class SAXError extends Error {
    private _position: SAXPosition;

    constructor(message: string, cx: SAXContext) {
        super(message);
        this._position = cx.position;
    }

    get line(): number {
        return this._position.line;
    }

    get column(): number {
        return this._position.column;
    }
}

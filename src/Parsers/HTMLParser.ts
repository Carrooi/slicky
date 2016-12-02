import {TextParser} from '../Parsers/TextParser';
import {Strings} from '../Util/Strings';
import {TemplateAttributeParser} from '../Parsers/TemplateAttributeParser';
import {ExpressionParser, ExpressionParserOptions} from './ExpressionParser';
import {Expression} from '../Interfaces';
import {Helpers} from '../Util/Helpers';


export enum HTMLAttributeType
{
	NATIVE,
	EXPRESSION,
	PROPERTY,
	EVENT,
	EXPORT,
	TEMPLATE,
}


export enum HTMLTokenType
{
	T_ELEMENT,
	T_STRING,
	T_EXPRESSION,
	T_COMMENT,
}


export declare interface AttributeToken
{
	type: HTMLAttributeType,
	name: string,
	value: string|Expression,
}


export declare interface StringToken
{
	type: HTMLTokenType,
	value: string,
	parent: ElementToken,
}


export declare interface ExpressionToken
{
	type: HTMLTokenType,
	expression: Expression,
	parent: ElementToken,
}


export declare interface ElementToken
{
	type: HTMLTokenType,
	name: string,
	attributes: {[name: string]: AttributeToken},
	parent: ElementToken,
	children: Array<StringToken|ElementToken>,
}


export class HTMLParser
{


	public static parse(html: string, options: ExpressionParserOptions = {}): Array<StringToken|ElementToken>
	{
		let parent = document.createElement('div');
		parent.innerHTML = html;

		return HTMLParser.parseBranch(parent, options);
	}


	public static parseElement(element: Element, options: ExpressionParserOptions = {}): ElementToken
	{
		return HTMLParser._parseElement(element, options, null, false);
	}


	private static parseBranch(node: Node, options: ExpressionParserOptions, parent: ElementToken = null): Array<StringToken|ElementToken>
	{
		let branch = [];
		let child: Node;

		if (node.nodeName.toLowerCase() === 'template' && typeof node['content'] !== 'undefined') {
			node = document.importNode(node, true)['content'];
		}

		for (let i = 0; i < node.childNodes.length; i++) {
			child = node.childNodes[i];

			if (child.nodeType === Node.TEXT_NODE) {
				let items = HTMLParser.parseText(<Text>child, options, parent);
				for (let i = 0; i < items.length; i++) {
					branch.push(items[i]);
				}

			} else if (child.nodeType === Node.ELEMENT_NODE) {
				branch.push(HTMLParser._parseElement(<Element>child, options, parent));

			}
		}

		return branch;
	}


	private static parseText(node: Text, options: ExpressionParserOptions, parent: ElementToken = null): Array<StringToken|ExpressionToken>
	{
		let tokens = TextParser.parse(node.nodeValue);

		if (tokens.length === 0) {
			// skip

		} else if (tokens.length === 1) {
			if (tokens[0].type === TextParser.TYPE_BINDING) {
				return [{
					type: HTMLTokenType.T_EXPRESSION,
					expression: ExpressionParser.parse(tokens[0].value, options),
					parent: parent,
				}];

			} else {
				return [{
					type: HTMLTokenType.T_STRING,
					value: node.nodeValue,
					parent: parent,
				}];
			}

		} else {
			let buffer: Array<StringToken|ExpressionToken> = [];

			for (let i = 0; i < tokens.length; i++) {
				let token = tokens[i];

				if (token.type === TextParser.TYPE_BINDING) {
					buffer.push({
						type: HTMLTokenType.T_EXPRESSION,
						expression: ExpressionParser.parse(token.value, options),
						parent: parent,
					});

				} else {
					buffer.push({
						type: HTMLTokenType.T_STRING,
						value: token.value,
						parent: parent,
					});
				}
			}

			return buffer;
		}
	}


	private static _parseElement(node: Element, options: ExpressionParserOptions, parent: ElementToken = null, parseChildren: boolean = true): ElementToken
	{
		let attributes = HTMLParser.parseAttributes(node, options);

		let nodeToken: ElementToken = {
			type: HTMLTokenType.T_ELEMENT,
			name: node.nodeName.toLowerCase(),
			attributes: {},
			parent: !parent || parent.name === 'template' ? null : parent,
			children: [],
		};

		if (parseChildren) {
			nodeToken.children = HTMLParser.parseBranch(node, options, nodeToken);
		}

		let rootTemplate: ElementToken;
		let parentTemplate: ElementToken;

		Helpers.each(attributes, (name: string, attribute: AttributeToken) => {
			if (attribute.type !== HTMLAttributeType.TEMPLATE) {
				nodeToken.attributes[attribute.name] = attribute;
				return;
			}

			let template: ElementToken = {
				type: HTMLTokenType.T_ELEMENT,
				name: 'template',
				attributes: {},
				parent: null,
				children: [],
			};

			let templateAttribute, templateAttributes = TemplateAttributeParser.parse('*' + attribute.name, <string>attribute.value);
			for (let j = 0; j < templateAttributes.length; j++) {
				templateAttribute = HTMLParser.parseAttribute(templateAttributes[j].name, templateAttributes[j].value, options);
				template.attributes[templateAttribute.name] = templateAttribute;
			}

			if (parentTemplate) {
				parentTemplate.children.push(template);
			} else {
				rootTemplate = template;
			}

			parentTemplate = template;
		});

		if (rootTemplate) {
			parentTemplate.children.push(nodeToken);
			nodeToken = rootTemplate;
		}

		return nodeToken;
	}


	public static parseAttributes(node: Element, options: ExpressionParserOptions = {}): {[name: string]: AttributeToken}
	{
		let attr, attributes = {};

		for (let i = 0; i < node.attributes.length; i++) {
			attr = HTMLParser.parseAttribute(node.attributes[i].name, node.attributes[i].value, options);
			attributes[attr.name] = attr;
		}

		return <any>attributes;
	}


	private static parseAttribute(name: string, value: string, options: ExpressionParserOptions): AttributeToken
	{
		let type = HTMLAttributeType.NATIVE;
		let match;

		if (match = name.match(/^\*(.+)/)) {
			type = HTMLAttributeType.TEMPLATE;
			name = match[1];
		} else if (match = name.match(/^#(.+)/)) {
			type = HTMLAttributeType.EXPORT;
			name = match[1];
		} else if (match = name.match(/^\[(.+)]$/)) {
			type = HTMLAttributeType.PROPERTY;
			name = match[1];
		} else if (match = name.match(/^\((.+)\)$/)) {
			type = HTMLAttributeType.EVENT;
			name = match[1];
		}

		if (type === HTMLAttributeType.NATIVE) {
			let attr = HTMLParser.parseAttributeValue(value);
			type = attr.type;
			value = attr.value;
		}

		name = Strings.hyphensToCamelCase(name);

		if ([HTMLAttributeType.EXPRESSION, HTMLAttributeType.PROPERTY, HTMLAttributeType.EVENT].indexOf(type) > -1) {
			value = <any>ExpressionParser.parse(value, options);
		}

		return {
			type: type,
			name: name,
			value: value,
		};
	}


	private static parseAttributeValue(value: string): {type: HTMLAttributeType, value: string}
	{
		let tokens = TextParser.parse(value);
		let type = HTMLAttributeType.NATIVE;

		if (tokens.length === 0) {
			// skip

		} else if (tokens.length === 1) {
			if (tokens[0].type === TextParser.TYPE_BINDING) {
				type = HTMLAttributeType.EXPRESSION;
				value = tokens[0].value;
			}

		} else {
			let buffer = [];

			for (let i = 0; i < tokens.length; i++) {
				let token = tokens[i];

				if (token.type === TextParser.TYPE_TEXT) {
					buffer.push('"' + token.value + '"');

				} else if (token.type === TextParser.TYPE_BINDING) {
					buffer.push('(' + token.value + ')');
				}
			}

			type = HTMLAttributeType.EXPRESSION;
			value = buffer.join('+');
		}

		return {
			type: type,
			value: value,
		};
	}

}
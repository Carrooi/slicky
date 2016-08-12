import {AbstractView} from './AbstractView';
import {DirectiveInstance} from '../Entity/DirectiveInstance';
import {ElementRef} from '../Templating/ElementRef';
import {TemplateRef} from '../Templating/TemplateRef';
import {ChangeDetector} from '../ChangeDetection/ChangeDetector';
import {ChangeDetectorRef} from '../ChangeDetection/ChangeDetectorRef';
import {ChangeDetectionStrategy} from '../ChangeDetection/constants';
import {ApplicationView} from './ApplicationView';
import {Helpers} from '../Util/Helpers';
import {Dom} from '../Util/Dom';
import {Container} from '../DI/Container';
import {IBinding} from '../Templating/Binding/IBinding';
import {ExpressionParser, Expression} from '../Parsers/ExpressionParser';
import {ViewAware} from '../Templating/Filters/ViewAware';
import {TypeParser} from '../Parsers/TypeParser';
import {SafeEval} from '../Util/SafeEval';
import {FilterMetadataDefinition} from '../Templating/Filters/Metadata';
import {Annotations} from '../Util/Annotations';
import {Functions} from '../Util/Functions';
import {Realm} from '../Util/Realm';
import {ParametersList, ChangedItem} from '../Interfaces';


export abstract class RenderableView extends AbstractView
{


	public container: Container;

	public parent: RenderableView|ApplicationView;

	public el: ElementRef;

	public realm: Realm;

	public changeDetector: ChangeDetector;

	public changeDetectorRef: ChangeDetectorRef;

	public directives: Array<any> = [];

	public translations: {[locale: string]: any} = {};

	public filters: {[name: string]: any} = {};

	public parameters: ParametersList = {};

	public attachedDirectives: Array<DirectiveInstance> = [];

	public bindings: Array<IBinding> = [];

	public templates: {[id: string]: TemplateRef} = {};


	constructor(container: Container, parent: RenderableView|ApplicationView, el: ElementRef, parameters: ParametersList = {})
	{
		super(parent);

		this.container = container;
		this.el = el;
		this.el.view = this;
		this.parameters = parameters;

		this.changeDetector = new ChangeDetector(
			this.parameters,
			this.parent.changeDetector
		);

		this.changeDetectorRef = new ChangeDetectorRef(() => {
			this.changeDetector.check();
		});

		this.realm = new Realm(this.parent.realm, null, () => {
			if (this.changeDetector.strategy === ChangeDetectionStrategy.Default) {
				this.changeDetectorRef.refresh();
			}
		});
	}


	public detach(): void
	{
		super.detach();

		this.changeDetector.disable();

		for (let i = 0; i < this.attachedDirectives.length; i++) {
			((directive: DirectiveInstance) => {
				this.run(() => directive.detach(), true);
			})(this.attachedDirectives[i]);
		}

		for (let i = 0; i < this.bindings.length; i++) {
			((binding: IBinding) => {
				this.run(() => binding.detach(), true);
			})(this.bindings[i]);
		}

		this.attachedDirectives = [];
	}


	public addParameter(name: string, value: any): void
	{
		if (typeof this.parameters[name] !== 'undefined') {
			throw new Error('Can not import variable ' + name + ' since its already in use.');
		}

		this.parameters[name] = value;
	}


	public addParameters(parameters: ParametersList): void
	{
		for (let name in parameters) {
			if (parameters.hasOwnProperty(name)) {
				this.addParameter(name, parameters[name]);
			}
		}
	}


	public watch(expr: Expression, listener: (changed: ChangedItem) => void): void
	{
		this.changeDetector.watch(expr, listener);
	}


	public run(fn: () => void, checkForChanges: boolean = false): any
	{
		let result = this.realm.run(fn);

		if (checkForChanges && this.changeDetector.strategy === ChangeDetectionStrategy.Default) {
			this.changeDetectorRef.refresh();
		}

		return result;
	}


	public eachDirective(iterator: (directive: any) => void): void
	{
		let iterated = [];

		for (let i = 0; i < this.directives.length; i++) {
			let directive = this.directives[i];

			if (iterated.indexOf(directive) > -1) {
				continue;
			}

			iterated.push(directive);
			iterator(directive);
		}

		let parent: RenderableView = <any>this.parent;

		while (parent && parent instanceof RenderableView) {
			for (let i = 0; i < parent.directives.length; i++) {
				let directive = parent.directives[i];

				if (iterated.indexOf(directive) > -1) {
					continue;
				}

				iterated.push(directive);
				iterator(directive);
			}

			parent = <any>parent.parent;
		}
	}


	public removeChildView(view: RenderableView): void
	{
		for (let i = 0; i < this.children.length; i++) {
			if (this.children[i] === view) {
				view.detach();

				this.children.splice(i, 1);

				return;
			}
		}
	}


	public attachDirective(instance: DirectiveInstance): void
	{
		this.attachedDirectives.push(instance);
	}


	public attachBinding(binding: IBinding, expression: Expression): void
	{
		this.run(() => binding.attach(), true);

		let hasOnChange = typeof binding['onChange'] === 'function';
		let hasOnUpdate = typeof binding['onUpdate'] === 'function';

		if (hasOnChange || hasOnUpdate) {
			if (hasOnUpdate) {
				this.run(() => binding['onUpdate'](ExpressionParser.parse(expression, this.parameters)), true);
			}

			this.watch(expression, (changed: ChangedItem) => {
				if (hasOnChange) {
					this.run(() => binding['onChange'](changed), true);
				}

				if (hasOnUpdate) {
					this.run(() => binding['onUpdate'](ExpressionParser.parse(expression, this.parameters)), true);
				}
			});
		}

		this.bindings.push(binding);
	}


	public addFilter(filter: any): void
	{
		let metadata: FilterMetadataDefinition = Annotations.getAnnotation(filter, FilterMetadataDefinition);

		if (!metadata) {
			throw new Error('Filter ' + Functions.getName(filter) + ' is not valid filter, please add @Filter annotation.');
		}

		this.filters[metadata.name] = this.container.create(filter);
	}


	public findFilter(name: string): any
	{
		if (typeof this.filters[name] !== 'undefined') {
			return this.filters[name];
		}

		if (this.parent instanceof RenderableView) {
			return (<RenderableView>this.parent).findFilter(name);
		}

		return null;
	}


	public applyFilters(value: string, expr: Expression): any
	{
		for (let i = 0; i < expr.filters.length; i++) {
			let filter = expr.filters[i];
			let filterInstance = this.findFilter(filter.name);

			if (!filterInstance) {
				throw new Error('Could not call filter "' + filter.name + '" in "' + expr.code + '" expression, filter is not registered.');
			}

			let args = [value];

			for (let j = 0; j < filter.args.length; j++) {
				let arg = filter.args[j];
				args.push(arg.type === TypeParser.TYPE_PRIMITIVE ? arg.value : SafeEval.run('return ' + arg.value, this.parameters).result);
			}

			if (typeof filterInstance['onView'] === 'function') {
				(<ViewAware>filterInstance).onView(this);
			}

			value = filterInstance.transform.apply(filterInstance, args);
		}

		return value;
	}


	public storeTemplate(template: TemplateRef): void
	{
		this.templates[template.getId()] = template;
	}


	public findTemplate(id: string): TemplateRef
	{
		if (typeof this.templates[id] === 'undefined') {
			return null;
		}

		return this.templates[id];
	}

}
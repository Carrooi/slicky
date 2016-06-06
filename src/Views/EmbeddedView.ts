import {AbstractView} from './AbstractView';
import {TemplateRef} from './../Templating/TemplateRef';
import {ElementRef} from './../Templating/ElementRef';
import {View} from './View';
import {Dom} from './../Util/Dom';
import {Objects} from './../Util/Objects';
import {Arrays} from './../Util/Arrays';


export class EmbeddedView extends AbstractView
{


	private templateRef: TemplateRef;

	public nodes: Array<Node> = [];

	private attached: boolean = false;


	constructor(view: View, templateRef: TemplateRef)
	{
		super(view);

		this.templateRef = templateRef;
	}


	public attach(marker: Comment): void
	{
		if (this.attached) {
			return;
		}

		let el = this.templateRef.el.nativeEl;
		if (this.templateRef.el.isElement('TEMPLATE') && el['content']) {
			el = document.importNode(el, true)['content'];
		}

		let childNodes = el.childNodes;

		for (let i = 0; i < childNodes.length; i++) {
			let clone = childNodes[i].cloneNode(true);

			Dom.insertBefore(clone, marker);

			this.nodes.push(clone);
		}

		this.attached = true;
	}


	public detach(): void
	{
		if (!this.attached) {
			return;
		}

		for (let i = 0; i < this.nodes.length; i++) {
			let node = this.nodes[i];

			if (ElementRef.exists(node)) {
				let elementRef = ElementRef.getByNode(node);

				if (elementRef.view) {
					elementRef.view.detach();
					elementRef.view.remove();
				}
			} else if (node.parentElement) {
				node.parentElement.removeChild(node);
			}
		}

		this.nodes = [];
	}


	public createNodeView(node: Node): View
	{
		let elementRef = ElementRef.getByNode(node);

		if (elementRef.view) {
			return elementRef.view;
		}

		let parameters = Objects.clone(this.parameters);
		let view = elementRef.view = new View(elementRef, parameters, this);

		view.translations = Objects.clone(this.translations);

		return view;
	}

}

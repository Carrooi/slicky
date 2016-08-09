import {IBinding} from './IBinding';
import {Dom} from '../../Util/Dom';
import {Helpers} from '../../Util/Helpers';
import {SafeEval} from '../../Util/SafeEval';
import {ComponentView} from '../../Views/ComponentView';


export class EventBinding implements IBinding
{


	private view: ComponentView;

	private el: Element;

	private call: string;

	private events: Array<string>;

	private listeners: Array<{event: string, listener: Function}> = [];


	constructor(view: ComponentView, el: Element, attr: string, call: string)
	{
		this.view = view;
		this.el = el;
		this.call = call;

		this.events = attr.split('|');
	}


	public attach(): void
	{
		let scope = Helpers.clone(this.view.parameters);

		for (let i = 0; i < this.events.length; i++) {
			((event) => {
				this.listeners.push({
					event: event,
					listener: Dom.addEventListener(this.el, event, this, (e: Event) => {
						let innerScope = Helpers.merge(scope, {
							'$event': e,
							'$this': this.el,
						});

						SafeEval.run(this.call, innerScope);
					}),
				});
			})(this.events[i]);
		}
	}


	public detach(): void
	{
		for (let i = 0; i < this.listeners.length; i++) {
			Dom.removeEventListener(this.el, this.listeners[i].event, this.listeners[i].listener);
		}

		this.listeners = [];
	}


	public onChange(): void
	{
		this.detach();
		this.attach();
	}

}

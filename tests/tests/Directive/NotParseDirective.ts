import {Application, Compiler, ApplicationView, Component} from '../../../core';
import {NotParseDirective} from '../../../common';
import {Container} from '../../../di';
import {Dom} from '../../../utils';

import chai = require('chai');


let expect = chai.expect;

let application: Application = null;
let compiler: Compiler = null;


describe('#Directives/NotParseDirective', () => {

	beforeEach(() => {
		let container = new Container;
		application = new Application(container);
		compiler = container.get(<any>Compiler);
	});

	it('should not parse inner html', () => {
		@Component({
			selector: '[test]',
			directives: [NotParseDirective],
		})
		class Test {}

		let el = Dom.el('<div><div test>{{ a }}, <span>{{ a }}</span>, <span [s:not-parse]>{{ a }}</span></div></div>');
		let view = new ApplicationView(el, Test, {
			a: 42,
		});

		compiler.compile(view);

		expect(el.innerText).to.be.equal('42, 42, {{ a }}');
	});

});

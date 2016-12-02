import {Component} from '../../../../src/Entity/Metadata';
import {Dom} from '../../../../src/Util/Dom';
import {OnInit} from '../../../../src/Interfaces';
import {ChangeDetectionStrategy} from '../../../../src/constants';
import {ChangeDetectorRef} from '../../../../src/ChangeDetection/ChangeDetectorRef';

import {createTemplate} from '../../_testHelpers';


import chai = require('chai');


let expect = chai.expect;
let parent: HTMLDivElement;


describe('#Templating/Compilers/ComponentCompiler.changeDetection', () => {

	beforeEach(() => {
		parent = document.createElement('div');
	});

	describe('compile()', () => {

		it('should use default change detection strategy', () => {
			@Component({
				selector: 'component',
				template: '{{ cmp.count }}<button (click)="cmp.count++"></button>',
				controllerAs: 'cmp',
			})
			class TestComponent implements OnInit {
				count = 0;
				onInit() {
					this.count++;
				}
			}

			createTemplate(parent, '<component></component>', {}, [TestComponent]);
			let button = parent.querySelector('button');

			expect(parent.innerText).to.be.equal('1');

			button.dispatchEvent(Dom.createMouseEvent('click'));

			expect(parent.innerText).to.be.equal('2');
		});

		it('should use OnPush strategy', () => {
			@Component({
				selector: 'component',
				template: '{{ cmp.count }}<button (click)="cmp.onClick()"></button>',
				controllerAs: 'cmp',
				changeDetection: ChangeDetectionStrategy.OnPush,
			})
			class TestComponent implements OnInit {
				count = 0;
				constructor(private changeDetector: ChangeDetectorRef) {}
				onInit() {
					this.count++;
				}
				onClick() {
					this.count++;
					this.changeDetector.refresh();
				}
			}

			createTemplate(parent, '<component></component>', {}, [TestComponent]);
			let button = parent.querySelector('button');

			expect(parent.innerText).to.be.equal('0');

			button.dispatchEvent(Dom.createMouseEvent('click'));

			expect(parent.innerText).to.be.equal('2');
		});

		it('should not invoke refresh from parent when using OnPush strategy', () => {
			@Component({
				selector: 'child',
				template: '{{ c.count }}',
				controllerAs: 'c',
				changeDetection: ChangeDetectionStrategy.OnPush,
			})
			class TestComponentChild implements OnInit {
				count = 0;
				onInit() {
					this.count++;
				}
			}

			@Component({
				selector: 'parent',
				template: '{{ p.count }} / <child></child>',
				controllerAs: 'p',
				directives: [TestComponentChild],
			})
			class TestComponentParent implements OnInit {
				count = 0;
				onInit() {
					this.count++;
				}
			}

			createTemplate(parent, '<parent></parent>', {}, [TestComponentParent]);

			expect(parent.innerText).to.be.equal('1 / 0');
		});

		it('should inherit change detection strategy from parent', () => {
			@Component({
				selector: 'child',
				template: '{{ c.count }}',
				controllerAs: 'c',
			})
			class TestComponentChild implements OnInit {
				count = 0;
				onInit() {
					this.count++;
				}
			}

			@Component({
				selector: 'parent',
				template: '{{ p.count }} / <child></child>',
				controllerAs: 'p',
				directives: [TestComponentChild],
				changeDetection: ChangeDetectionStrategy.OnPush,
			})
			class TestComponentParent implements OnInit {
				count = 0;
				onInit() {
					this.count++;
				}
			}

			createTemplate(parent, '<parent></parent>', {}, [TestComponentParent]);

			expect(parent.innerText).to.be.equal('0 / 0');
		});

		it('should update exported property', () => {
			@Component({
				selector: 'component',
				template: '',
			})
			class TestComponent implements OnInit {
				count = 0;
				onInit() {
					this.count++;
				}
			}

			createTemplate(parent, '<component #c></component>{{ c.count }}', {}, [TestComponent]);

			expect(parent.innerText).to.be.equal('1');
		});

	});

});
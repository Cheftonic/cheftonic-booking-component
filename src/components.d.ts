/**
 * This is an autogenerated file created by the Stencil build process.
 * It contains typing information for all components that exist in this project
 * and imports for stencil collections that might be configured in your stencil.config.js file
 */

import '@stencil/core';

declare global {
  namespace JSX {
    interface Element {}
    export interface IntrinsicElements {}
  }
  namespace JSXElements {}

  interface HTMLStencilElement extends HTMLElement {
    componentOnReady(): Promise<this>;
    componentOnReady(done: (ele?: this) => void): void;

    forceUpdate(): void;
  }

  interface HTMLAttributes {}
}


declare global {

  namespace StencilComponents {
    interface CheftonicBookingComponent {
      'apikey': string;
    }
  }

  interface HTMLCheftonicBookingComponentElement extends StencilComponents.CheftonicBookingComponent, HTMLStencilElement {}

  var HTMLCheftonicBookingComponentElement: {
    prototype: HTMLCheftonicBookingComponentElement;
    new (): HTMLCheftonicBookingComponentElement;
  };
  interface HTMLElementTagNameMap {
    'cheftonic-booking-component': HTMLCheftonicBookingComponentElement;
  }
  interface ElementTagNameMap {
    'cheftonic-booking-component': HTMLCheftonicBookingComponentElement;
  }
  namespace JSX {
    interface IntrinsicElements {
      'cheftonic-booking-component': JSXElements.CheftonicBookingComponentAttributes;
    }
  }
  namespace JSXElements {
    export interface CheftonicBookingComponentAttributes extends HTMLAttributes {
      'apikey'?: string;
    }
  }
}

declare global { namespace JSX { interface StencilJSX {} } }

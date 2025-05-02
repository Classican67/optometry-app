import { config } from "@vue/test-utils";
import { createApp } from "vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "vuetify/styles";

const vuetify = createVuetify({
  components,
  directives,
});

// Créer une application Vue pour configurer Vuetify
const app = createApp({});
app.use(vuetify);

// Configurer Vue Test Utils
config.global.plugins = [vuetify];

// Configurer les stubs pour les composants Vuetify
const defaultStubs = {};
Object.keys(components).forEach((componentName) => {
  defaultStubs[componentName] = {
    name: componentName,
    template: `<div data-test="${componentName}"><slot /></div>`,
  };
});

config.global.stubs = defaultStubs;

// Configuration de l'environnement de test
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Configuration de l'intersection observer
window.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

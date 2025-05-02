import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoute, useRouter } from "vue-router";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { dbService } from "../../services/db";
import { pdfService } from "../../services/pdfService";
import RefractionObjective from "../RefractionObjective.vue";

// Mock des dépendances
vi.mock("vue-router", () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("../../services/db", () => ({
  dbService: {
    getSection: vi.fn(),
    saveSection: vi.fn(),
  },
}));

vi.mock("../../services/pdfService", () => ({
  pdfService: {
    generateSectionPDF: vi.fn(),
  },
}));

describe("RefractionObjective", () => {
  const vuetify = createVuetify({
    components,
    directives,
  });

  const mockRouter = {
    push: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useRoute.mockReturnValue({ params: { examId: "123" } });
    useRouter.mockReturnValue(mockRouter);
  });

  it("devrait charger les données existantes au montage", async () => {
    const mockData = {
      od: {
        sphere: "+1.00",
        cylindre: "-0.50",
        axe: "180",
        vision: "1.0",
      },
      og: {
        sphere: "+1.25",
        cylindre: "-0.75",
        axe: "175",
        vision: "1.0",
      },
      notes: "",
    };
    dbService.getSection.mockResolvedValue({ data: mockData });

    const wrapper = mount(RefractionObjective, {
      global: {
        plugins: [vuetify],
      },
    });

    // Attendre que le composant soit monté et que les données soient chargées
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dbService.getSection).toHaveBeenCalledWith(
      "123",
      "refraction-objective"
    );
    expect(wrapper.vm.form.value.od).toEqual(mockData.od);
    expect(wrapper.vm.form.value.og).toEqual(mockData.og);
  });

  it("devrait soumettre le formulaire et rediriger", async () => {
    const wrapper = mount(RefractionObjective, {
      global: {
        plugins: [vuetify],
      },
    });
    const formData = {
      od: {
        sphere: "+1.00",
        cylindre: "-0.50",
        axe: "180",
        vision: "1.0",
      },
      og: {
        sphere: "+1.25",
        cylindre: "-0.75",
        axe: "175",
        vision: "1.0",
      },
      notes: "Test notes",
    };

    // Simuler la saisie des données
    await wrapper.vm.$nextTick();
    wrapper.vm.form.value = { ...formData };

    // Soumettre le formulaire
    await wrapper.find('[data-test="submit-button"]').trigger("click");

    expect(dbService.saveSection).toHaveBeenCalledWith(
      "123",
      "refraction-objective",
      formData
    );
    expect(pdfService.generateSectionPDF).toHaveBeenCalledWith(
      "123",
      "refraction-objective",
      formData
    );
    expect(mockRouter.push).toHaveBeenCalledWith("/refraction-subjective");
  });

  it("devrait gérer les erreurs lors de la soumission", async () => {
    const error = new Error("Erreur de sauvegarde");
    dbService.saveSection.mockRejectedValue(error);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const wrapper = mount(RefractionObjective, {
      global: {
        plugins: [vuetify],
      },
    });
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="submit-button"]').trigger("click");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Erreur lors de la sauvegarde:",
      error
    );

    consoleErrorSpy.mockRestore();
  });
});

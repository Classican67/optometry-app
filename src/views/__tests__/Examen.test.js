import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRouter,
  createWebHistory,
  useRoute,
  useRouter,
} from "vue-router";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { dbService } from "../../services/db";
import { pdfService } from "../../services/pdfService";
import Examen from "../Examen.vue";
import HistoireCas from "../HistoireCas.vue";

// Mock des dépendances
vi.mock("vue-router", () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("../../services/db", () => ({
  dbService: {
    getSection: vi.fn(),
    saveSection: vi.fn(),
    getExam: vi.fn(),
    saveExam: vi.fn(),
  },
}));

vi.mock("../../services/pdfService", () => ({
  pdfService: {
    generateSectionPDF: vi.fn(),
  },
}));

vi.mock("../../services/auth", () => ({
  authService: {
    getCurrentUser: vi.fn(),
  },
}));

describe("HistoireCas", () => {
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
      motifConsultation: "Test motif",
      antecedents: "Test antécédents",
      antecedentsFamiliaux: "",
      traitements: "",
      allergies: "",
      habitudesVisuelles: "",
    };
    dbService.getSection.mockResolvedValue({ data: mockData });

    const wrapper = mount(HistoireCas, {
      global: {
        plugins: [vuetify],
      },
    });

    // Attendre que le composant soit monté et que les données soient chargées
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dbService.getSection).toHaveBeenCalledWith("123", "histoire");
    expect(wrapper.vm.form.value.motifConsultation).toBe(
      mockData.motifConsultation
    );
    expect(wrapper.vm.form.value.antecedents).toBe(mockData.antecedents);
  });

  it("devrait soumettre le formulaire et rediriger", async () => {
    const wrapper = mount(HistoireCas, {
      global: {
        plugins: [vuetify],
      },
    });
    const formData = {
      motifConsultation: "Nouveau motif",
      antecedents: "Nouveaux antécédents",
      antecedentsFamiliaux: "",
      traitements: "",
      allergies: "",
      habitudesVisuelles: "",
    };

    // Simuler la saisie des données
    await wrapper.vm.$nextTick();
    wrapper.vm.form.value = { ...formData };

    // Soumettre le formulaire
    await wrapper.find('[data-test="submit-button"]').trigger("click");

    expect(dbService.saveSection).toHaveBeenCalledWith(
      "123",
      "histoire",
      formData
    );
    expect(pdfService.generateSectionPDF).toHaveBeenCalledWith(
      "123",
      "histoire",
      formData
    );
    expect(mockRouter.push).toHaveBeenCalledWith("/refraction-objective");
  });

  it("devrait gérer les erreurs lors de la soumission", async () => {
    const error = new Error("Erreur de sauvegarde");
    dbService.saveSection.mockRejectedValue(error);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const wrapper = mount(HistoireCas, {
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

describe("Examen", () => {
  let router;

  beforeEach(() => {
    router = createRouter({
      history: createWebHistory(),
      routes: [
        {
          path: "/examen/:examId",
          name: "examen",
          component: Examen,
        },
      ],
    });
  });

  it("devrait charger les données de l'examen", async () => {
    const examId = "123";
    const wrapper = mount(Examen, {
      global: {
        plugins: [router],
      },
      props: {
        examId,
      },
    });

    // Vérifications...
  });

  it("devrait sauvegarder les données de l'examen", async () => {
    const examId = "123";
    const wrapper = mount(Examen, {
      global: {
        plugins: [router],
      },
      props: {
        examId,
      },
    });

    // Vérifications...
  });
});

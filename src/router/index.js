import { createRouter, createWebHistory } from "vue-router";
import { authService } from "../services/auth";
import HistoireCas from "../views/HistoireCas.vue";
import Home from "../views/Home.vue";
import IdentificationPatient from "../views/IdentificationPatient.vue";
import LesionsCanvas from "../views/LesionsCanvas.vue";
import Login from "../views/Login.vue";
import RefractionObjective from "../views/RefractionObjective.vue";
import RefractionSubjective from "../views/RefractionSubjective.vue";

const routes = [
  {
    path: "/login",
    name: "Login",
    component: Login,
  },
  {
    path: "/",
    name: "Home",
    component: Home,
    meta: { requiresAuth: true },
  },
  {
    path: "/identification/:examId?",
    name: "IdentificationPatient",
    component: IdentificationPatient,
    props: true,
    meta: { requiresAuth: true },
  },
  {
    path: "/histoire/:examId",
    name: "HistoireCas",
    component: HistoireCas,
    props: true,
    meta: { requiresAuth: true },
  },
  {
    path: "/refraction-objective/:examId",
    name: "RefractionObjective",
    component: RefractionObjective,
    props: true,
    meta: { requiresAuth: true },
  },
  {
    path: "/refraction-subjective/:examId",
    name: "RefractionSubjective",
    component: RefractionSubjective,
    props: true,
    meta: { requiresAuth: true },
  },
  {
    path: "/lesions/:examId",
    name: "Lesions",
    component: LesionsCanvas,
    props: true,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard pour vérifier l'authentification
router.beforeEach((to, from, next) => {
  if (to.matched.some((record) => record.meta.requiresAuth)) {
    if (!authService.isAuthenticated()) {
      next({
        path: "/login",
        query: { redirect: to.fullPath },
      });
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;

import { createRouter, createWebHistory } from "vue-router";
import { authService } from "../services/auth";
import LesionsCanvas from "../views/LesionsCanvas.vue";
import Profile from "../views/Profile.vue";
import RefractionObjective from "../views/RefractionObjective.vue";
import RefractionSubjective from "../views/RefractionSubjective.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import("../views/Home.vue"),
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/Login.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/register",
    name: "Register",
    component: () => import("../views/Register.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/identification/:examId",
    name: "Identification",
    component: () => import("../views/IdentificationPatient.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/examen/:examId",
    name: "Examen",
    component: () => import("../views/Examen.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/reference/:examId",
    name: "Reference",
    component: () => import("../views/Reference.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/utiles/:examId",
    name: "Utiles",
    component: () => import("../views/Utiles.vue"),
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
  {
    path: "/profile",
    name: "Profile",
    component: Profile,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard pour vérifier l'authentification
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const isAuthenticated = authService.isAuthenticated();

  if (requiresAuth && !isAuthenticated) {
    next("/login");
  } else if (
    (to.path === "/login" || to.path === "/register") &&
    isAuthenticated
  ) {
    next("/");
  } else {
    next();
  }
});

export default router;

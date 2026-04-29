import { onRequestGet as __api_aggregate_js_onRequestGet } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\aggregate.js"
import { onRequestOptions as __api_aggregate_js_onRequestOptions } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\aggregate.js"
import { onRequestGet as __api_phase_js_onRequestGet } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\phase.js"
import { onRequestOptions as __api_phase_js_onRequestOptions } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\phase.js"
import { onRequestPut as __api_phase_js_onRequestPut } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\phase.js"
import { onRequestGet as __api_responses_js_onRequestGet } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\responses.js"
import { onRequestOptions as __api_responses_js_onRequestOptions } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\responses.js"
import { onRequestPost as __api_responses_js_onRequestPost } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\responses.js"
import { onRequestOptions as __api_seed_js_onRequestOptions } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\seed.js"
import { onRequestPost as __api_seed_js_onRequestPost } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\seed.js"
import { onRequestDelete as __api_wipe_js_onRequestDelete } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\wipe.js"
import { onRequestOptions as __api_wipe_js_onRequestOptions } from "C:\\DevOps\\herramientas-educativas\\.claude\\worktrees\\wonderful-bhaskara-5470a5\\encuesta-diagnostica-ia\\functions\\api\\wipe.js"

export const routes = [
    {
      routePath: "/api/aggregate",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_aggregate_js_onRequestGet],
    },
  {
      routePath: "/api/aggregate",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_aggregate_js_onRequestOptions],
    },
  {
      routePath: "/api/phase",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_phase_js_onRequestGet],
    },
  {
      routePath: "/api/phase",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_phase_js_onRequestOptions],
    },
  {
      routePath: "/api/phase",
      mountPath: "/api",
      method: "PUT",
      middlewares: [],
      modules: [__api_phase_js_onRequestPut],
    },
  {
      routePath: "/api/responses",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_responses_js_onRequestGet],
    },
  {
      routePath: "/api/responses",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_responses_js_onRequestOptions],
    },
  {
      routePath: "/api/responses",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_responses_js_onRequestPost],
    },
  {
      routePath: "/api/seed",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_seed_js_onRequestOptions],
    },
  {
      routePath: "/api/seed",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_seed_js_onRequestPost],
    },
  {
      routePath: "/api/wipe",
      mountPath: "/api",
      method: "DELETE",
      middlewares: [],
      modules: [__api_wipe_js_onRequestDelete],
    },
  {
      routePath: "/api/wipe",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_wipe_js_onRequestOptions],
    },
  ]
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routerHandler = void 0;
const router_1 = require("./router");
const publicRoutes_1 = require("./publicRoutes");
const workflowRoutes_1 = require("./workflowRoutes");
const formRoutes_1 = require("./formRoutes");
const templateRoutes_1 = require("./templateRoutes");
const jobRoutes_1 = require("./jobRoutes");
const adminRoutes_1 = require("./adminRoutes");
const fileRoutes_1 = require("./fileRoutes");
const impersonationRoutes_1 = require("./impersonationRoutes");
const authRoutes_1 = require("./authRoutes");
const folderRoutes_1 = require("./folderRoutes");
// Register all routes on module load
(0, publicRoutes_1.registerPublicRoutes)();
(0, workflowRoutes_1.registerWorkflowRoutes)();
(0, formRoutes_1.registerFormRoutes)();
(0, templateRoutes_1.registerTemplateRoutes)();
(0, jobRoutes_1.registerJobRoutes)();
(0, adminRoutes_1.registerAdminRoutes)();
(0, fileRoutes_1.registerFileRoutes)();
(0, impersonationRoutes_1.registerImpersonationRoutes)();
(0, authRoutes_1.registerAuthRoutes)();
(0, folderRoutes_1.registerFolderRoutes)();
/**
 * Main router function.
 * Uses simplified router to match requests to handlers.
 */
const routerHandler = async (event, tenantId) => {
    return await router_1.router.match(event, tenantId);
};
exports.routerHandler = routerHandler;
//# sourceMappingURL=index.js.map
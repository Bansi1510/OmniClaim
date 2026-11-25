/**
 * Centralized Permission and Module Dictionary
 * Modeled after C:\college erp\kn_college_erp_react_frontend\src\service\modules.js
 */
const modules = {
  // Claims Operations
  claims: 'claims',
  claims_view: 'claims:read',
  claims_add: 'claims:create',
  claims_edit: 'claims:update',
  claims_delete: 'claims:delete',
  claims_approve: 'claims:approve',
  claims_settle: 'claims:settle',
  claims_override_reconciliation: 'claims:override_reconciliation',

  // Fraud & SIU Intelligence
  fraud: 'fraud',
  fraud_view: 'fraud:read',
  fraud_override: 'fraud:override',
  fraud_flag: 'fraud:flag',

  // Parts Catalog & Pricing
  parts: 'parts',
  parts_view: 'parts:read',
  parts_add: 'parts:create',
  parts_edit: 'parts:update',
  parts_delete: 'parts:delete',

  // Double-Entry Financial Ledger
  ledger: 'ledger',
  ledger_view: 'ledger:read',
  ledger_reconcile: 'ledger:reconcile',
  ledger_override: 'ledger:override',

  // Setup & Access Control (Matching College ERP)
  setup: 'setup',
  setup_role: 'rbac:roles',
  setup_role_view: 'rbac:roles_read',
  setup_role_add: 'rbac:roles_create',
  setup_role_edit: 'rbac:roles_update',
  setup_role_delete: 'rbac:roles_delete',
  setup_role_assign_permission: 'rbac:roles_assign',
  setup_role_update_hierarchy: 'rbac:roles_hierarchy',
  setup_user: 'rbac:users',
  setup_user_view: 'rbac:users_read',
  setup_user_add: 'rbac:users_create',
  setup_user_edit: 'rbac:users_update',
  setup_user_delete: 'rbac:users_delete',
  setup_user_assign_role: 'rbac:users_assign',

  // Audit Trail & Compliance
  audit: 'audit',
  audit_view: 'audit:read',

  // Analytics & Reporting
  reports: 'reports',
  reports_view: 'reports:read',
  reports_export: 'reports:export',
} as const;

export type ModuleKey = keyof typeof modules;
export default modules;

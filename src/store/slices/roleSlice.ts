import type { StoreSet, StoreGet, RoleSlice } from '../types';
import {
  fetchRoleDefinitions as dbFetchRoleDefinitions,
  createRoleDefinition as dbCreateRoleDefinition,
  updateRoleDefinition as dbUpdateRoleDefinition,
  deleteRoleDefinition as dbDeleteRoleDefinition,
  fetchUserRoles as dbFetchUserRoles,
  updateUserRole as dbUpdateUserRole,
  updateUserPin as dbUpdateUserPin,
  getUserRoleByUid as dbGetUserRoleByUid,
  generateGlobalId as dbGenerateGlobalId,
  deactivateUser as dbDeactivateUser,
  reactivateUser as dbReactivateUser,
  updateUserProfile as dbUpdateUserProfile,
  authorizePin as dbAuthorizePin,
} from '@/app/actions/db-actions';

export const createRoleSlice = (set: StoreSet, get: StoreGet): RoleSlice => ({
  roleDefinitions: [],
  userRoles: [],
  currentUserRole: null,

  fetchRoleDefinitions: async () => {
    try {
      const defs = await dbFetchRoleDefinitions();
      set({ roleDefinitions: defs });
    } catch (error) {
      console.error('[store:role] fetchRoleDefinitions failed', error);
    }
  },

  createRoleDefinition: async (data, createdByUid) => {
    try {
      const newDef = await dbCreateRoleDefinition(data, createdByUid);
      const state = get();
      set({ roleDefinitions: [...state.roleDefinitions, newDef] });
      return newDef;
    } catch (error) {
      console.error('[store:role] createRoleDefinition failed', error);
      throw error;
    }
  },

  updateRoleDefinition: async (id, data) => {
    try {
      await dbUpdateRoleDefinition(id, data);
      const state = get();
      set({
        roleDefinitions: state.roleDefinitions.map((d) =>
          d.id === id ? { ...d, ...data, updatedAt: new Date().toISOString() } : d,
        ),
      });
    } catch (error) {
      console.error('[store:role] updateRoleDefinition failed', error);
      throw error;
    }
  },

  deleteRoleDefinition: async (id) => {
    try {
      await dbDeleteRoleDefinition(id);
      const state = get();
      set({ roleDefinitions: state.roleDefinitions.filter((d) => d.id !== id) });
    } catch (error) {
      console.error('[store:role] deleteRoleDefinition failed', error);
      throw error;
    }
  },

  fetchRoles: async () => {
    try {
      const roles = await dbFetchUserRoles();
      set({ userRoles: roles });
    } catch (error) {
      console.error('[store:role] fetchRoles failed', error);
    }
  },

  updateRole: async (cognitoSub, newRoleId, assignedByUid) => {
    try {
      await dbUpdateUserRole(cognitoSub, newRoleId, assignedByUid);
      const state = get();
      set({
        userRoles: state.userRoles.map((r) =>
          r.cognitoSub === cognitoSub ? { ...r, roleId: newRoleId, updatedAt: new Date().toISOString() } : r,
        ),
      });
    } catch (error) {
      console.error('[store:role] updateRole failed', error);
      throw error;
    }
  },

  updateUserPin: async (cognitoSub, pinCode) => {
    try {
      await dbUpdateUserPin(cognitoSub, pinCode);
      const state = get();
      set({
        userRoles: state.userRoles.map((r) =>
          r.cognitoSub === cognitoSub ? { ...r, pinCode, updatedAt: new Date().toISOString() } : r,
        ),
      });
      if (state.currentUserRole?.cognitoSub === cognitoSub) {
        set({ currentUserRole: { ...state.currentUserRole, pinCode } });
      }
    } catch (error) {
      console.error('[store:role] updateUserPin failed', error);
      throw error;
    }
  },

  getUserRole: async (cognitoSub) => {
    // Prevent permissions from the previous identity from remaining visible
    // while the active tenant authorization context is being resolved.
    set({ currentUserRole: null, roleDefinitions: [], userRoles: [] });
    try {
      const context = await dbGetUserRoleByUid(cognitoSub);
      if (!context) return null;

      const state = get();
      const roleDefinitions = state.roleDefinitions.some(
        (definition) => definition.id === context.roleDefinition.id,
      )
        ? state.roleDefinitions.map((definition) =>
            definition.id === context.roleDefinition.id ? context.roleDefinition : definition,
          )
        : [...state.roleDefinitions, context.roleDefinition];

      set({
        currentUserRole: context.userRole,
        roleDefinitions,
      });
      return context.userRole;
    } catch (error) {
      console.error('[store:role] getUserRole failed', error);
      return null;
    }
  },

  generateGlobalId: async (cognitoSub) => {
    try {
      const globalId = await dbGenerateGlobalId(cognitoSub);
      const state = get();
      set({
        userRoles: state.userRoles.map((r) =>
          r.cognitoSub === cognitoSub ? { ...r, globalId, updatedAt: new Date().toISOString() } : r,
        ),
      });
      return globalId;
    } catch (error) {
      console.error('[store:role] generateGlobalId failed', error);
      throw error;
    }
  },

  deactivateUser: async (cognitoSub) => {
    try {
      await dbDeactivateUser(cognitoSub);
      const state = get();
      const now = new Date().toISOString();
      set({
        userRoles: state.userRoles.map((r) =>
          r.cognitoSub === cognitoSub ? { ...r, status: 'baja' as const, deactivatedAt: now, updatedAt: now } : r,
        ),
      });
    } catch (error) {
      console.error('[store:role] deactivateUser failed', error);
      throw error;
    }
  },

  reactivateUser: async (cognitoSub) => {
    try {
      await dbReactivateUser(cognitoSub);
      const state = get();
      const now = new Date().toISOString();
      set({
        userRoles: state.userRoles.map((r) =>
          r.cognitoSub === cognitoSub
            ? { ...r, status: 'activo' as const, deactivatedAt: undefined, updatedAt: now }
            : r,
        ),
      });
    } catch (error) {
      console.error('[store:role] reactivateUser failed', error);
      throw error;
    }
  },

  updateUserProfile: async (cognitoSub, data) => {
    try {
      const updated = await dbUpdateUserProfile(cognitoSub, data);
      const state = get();
      set({
        currentUserRole: state.currentUserRole?.cognitoSub === cognitoSub ? updated : state.currentUserRole,
        userRoles: state.userRoles.map((r) => (r.cognitoSub === cognitoSub ? updated : r)),
      });
      return updated;
    } catch (error) {
      console.error('[store:role] updateUserProfile failed', error);
      throw error;
    }
  },

  authorizePin: async (pinCode, requiredPermission, approvalContext) => {
    try {
      return await dbAuthorizePin(pinCode, requiredPermission, approvalContext);
    } catch (error) {
      console.error('[store:role] authorizePin failed', error);
      return { success: false, error: 'Network error validating PIN' };
    }
  },
});

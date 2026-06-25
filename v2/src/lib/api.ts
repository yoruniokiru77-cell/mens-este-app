// Supabase APIラッパー — エントリーポイント（各サービスにディスパッチ）

import { getTherapists, getTherapistProfiles, saveTherapistProfile, getLineUsers, getInitialData, getTherapistInterval, getTherapistCourseBack, getTherapistMaster, updateLineUser, deactivateTherapist, hireTherapist, rejectTherapist, linkLineUser, checkTherapistName, registerTherapistFromLine, getInterviews, saveInterview, deleteInterview, saveManualLineEntry } from './services/therapistService';
import { getReservations, addReservation, updateReservation, deleteReservation, cancelReservation, recordCancellation, getMyReservations } from './services/reservationService';
import { saveSalesEntry, getSalesData, updateSalesRow, deleteSalesRow, getTherapistsFromSales, saveSaleOptions } from './services/salesService';
import { getPayrollData, getMenuBacks, saveMenuBacks, getUnsubmittedTherapists } from './services/payrollService';
import { submitShiftBulk, getShifts, approveShift, rejectShift, restoreShiftToPending, deleteShift, submitDayoffRequest, getDayoffRequests, approveDayoffRequest, rejectDayoffRequest, setAttendance, assignRoomToShift, updateShift, addInterviewShift, sendShiftReminder, sendReminderToOne } from './services/shiftService';
import { getCustomer, saveCustomer, updateCustomer, getCustomerMasterList, getCustomerHistory, saveCustomerMemo, updateCustomerMemo, deleteCustomerMemo, getMyCustomers, checkCustomerStatus, importCustomers } from './services/customerService';
import { getExpenses, saveStoreExpense, saveExpense, deleteExpenseByCategory, deleteExpense, getFixedCostMasters, saveFixedCostMaster, deleteFixedCostMaster, getFixedCostPayments, saveFixedCostPayment, getPaymentDestinations, savePaymentDestination, deletePaymentDestination, getExpenseTemplates, saveExpenseTemplate, deleteExpenseTemplate, getAllStoreFixedCostSummary } from './services/expenseService';
import { getMenuMaster, saveMenuMaster, deleteMenuMaster, getRoomMaster, saveRoomMaster, deleteRoomMaster, getChecklistByStore, saveChecklistItem, deleteChecklistItem, saveCheckoutLog, getManuals, saveManual, deleteManual } from './services/masterService';
import { getScoutCompanies, saveScoutCompany, getTherapistScout, saveTherapistScout, deleteTherapistScout, getScoutSummary } from './services/scoutService';
import { getStoreSettings, saveStoreSettings } from './services/storeService';
import { verifyTokenAction, sendLineMessage } from './services/lineService';

export async function apiGet(action: string, params: Record<string, any> = {}): Promise<any> {
  switch(action) {
    case 'getTherapists':            return getTherapists(params);
    case 'getTherapistProfiles':     return getTherapistProfiles(params);
    case 'saveTherapistProfile':     return saveTherapistProfile(params);
    case 'getLineUsers':             return getLineUsers(params);
    case 'getInitialData':           return getInitialData(params);
    case 'getTherapistInterval':     return getTherapistInterval(params);
    case 'getTherapistCourseBack':   return getTherapistCourseBack(params);
    case 'getTherapistMaster':       return getTherapistMaster(params);
    case 'updateLineUser':           return updateLineUser(params);
    case 'deactivateTherapist':      return deactivateTherapist(params);
    case 'hireTherapist':            return hireTherapist(params);
    case 'rejectTherapist':          return rejectTherapist(params);
    case 'linkLineUser':             return linkLineUser(params);
    case 'checkTherapistName':       return checkTherapistName(params);
    case 'registerTherapistFromLine':return registerTherapistFromLine(params);
    case 'getInterviews':            return getInterviews(params);
    case 'saveInterview':            return saveInterview(params);
    case 'deleteInterview':          return deleteInterview(params);
    case 'saveManualLineEntry':      return saveManualLineEntry(params);
    case 'getReservations':          return getReservations(params);
    case 'addReservation':           return addReservation(params);
    case 'updateReservation':        return updateReservation(params);
    case 'deleteReservation':        return deleteReservation(params);
    case 'cancelReservation':        return cancelReservation(params);
    case 'recordCancellation':       return recordCancellation(params);
    case 'getMyReservations':        return getMyReservations(params);
    case 'saveSalesEntry':           return saveSalesEntry(params);
    case 'getSalesData':             return getSalesData(params);
    case 'updateSalesRow':           return updateSalesRow(params);
    case 'deleteSalesRow':           return deleteSalesRow(params);
    case 'getTherapistsFromSales':   return getTherapistsFromSales(params);
    case 'saveSaleOptions':          return saveSaleOptions(params);
    case 'getPayrollData':           return getPayrollData(params);
    case 'getMenuBacks':             return getMenuBacks(params);
    case 'saveMenuBacks':            return saveMenuBacks(params);
    case 'getUnsubmittedTherapists': return getUnsubmittedTherapists(params);
    case 'submitShiftBulk':          return submitShiftBulk(params);
    case 'getShifts':                return getShifts(params);
    case 'approveShift':             return approveShift(params);
    case 'rejectShift':              return rejectShift(params);
    case 'restoreShiftToPending':    return restoreShiftToPending(params);
    case 'deleteShift':              return deleteShift(params);
    case 'submitDayoffRequest':      return submitDayoffRequest(params);
    case 'getDayoffRequests':        return getDayoffRequests(params);
    case 'approveDayoffRequest':     return approveDayoffRequest(params);
    case 'rejectDayoffRequest':      return rejectDayoffRequest(params);
    case 'setAttendance':            return setAttendance(params);
    case 'assignRoomToShift':        return assignRoomToShift(params);
    case 'updateShift':              return updateShift(params);
    case 'addInterviewShift':        return addInterviewShift(params);
    case 'sendShiftReminder':        return sendShiftReminder(params);
    case 'sendReminderToOne':        return sendReminderToOne(params);
    case 'getCustomer':              return getCustomer(params);
    case 'saveCustomer':             return saveCustomer(params);
    case 'updateCustomer':           return updateCustomer(params);
    case 'getCustomerMasterList':    return getCustomerMasterList(params);
    case 'getCustomerHistory':       return getCustomerHistory(params);
    case 'saveCustomerMemo':         return saveCustomerMemo(params);
    case 'updateCustomerMemo':       return updateCustomerMemo(params);
    case 'deleteCustomerMemo':       return deleteCustomerMemo(params);
    case 'getMyCustomers':           return getMyCustomers(params);
    case 'checkCustomerStatus':      return checkCustomerStatus(params);
    case 'importCustomers':          return importCustomers(params);
    case 'getExpenses':              return getExpenses(params);
    case 'saveStoreExpense':         return saveStoreExpense(params);
    case 'saveExpense':              return saveExpense(params);
    case 'deleteExpenseByCategory':  return deleteExpenseByCategory(params);
    case 'deleteExpense':            return deleteExpense(params);
    case 'getFixedCostMasters':      return getFixedCostMasters(params);
    case 'saveFixedCostMaster':      return saveFixedCostMaster(params);
    case 'deleteFixedCostMaster':    return deleteFixedCostMaster(params);
    case 'getFixedCostPayments':     return getFixedCostPayments(params);
    case 'saveFixedCostPayment':     return saveFixedCostPayment(params);
    case 'getPaymentDestinations':   return getPaymentDestinations(params);
    case 'savePaymentDestination':   return savePaymentDestination(params);
    case 'deletePaymentDestination': return deletePaymentDestination(params);
    case 'getExpenseTemplates':      return getExpenseTemplates(params);
    case 'saveExpenseTemplate':      return saveExpenseTemplate(params);
    case 'deleteExpenseTemplate':    return deleteExpenseTemplate(params);
    case 'getAllStoreFixedCostSummary': return getAllStoreFixedCostSummary(params);
    case 'getMenuMaster':            return getMenuMaster(params);
    case 'saveMenuMaster':           return saveMenuMaster(params);
    case 'deleteMenuMaster':         return deleteMenuMaster(params);
    case 'getRoomMaster':            return getRoomMaster(params);
    case 'saveRoomMaster':           return saveRoomMaster(params);
    case 'deleteRoomMaster':         return deleteRoomMaster(params);
    case 'getChecklistByStore':      return getChecklistByStore(params);
    case 'saveChecklistItem':        return saveChecklistItem(params);
    case 'deleteChecklistItem':      return deleteChecklistItem(params);
    case 'saveCheckoutLog':          return saveCheckoutLog(params);
    case 'getManuals':               return getManuals(params);
    case 'saveManual':               return saveManual(params);
    case 'deleteManual':             return deleteManual(params);
    case 'getScoutCompanies':        return getScoutCompanies(params);
    case 'saveScoutCompany':         return saveScoutCompany(params);
    case 'getTherapistScout':        return getTherapistScout(params);
    case 'saveTherapistScout':       return saveTherapistScout(params);
    case 'deleteTherapistScout':     return deleteTherapistScout(params);
    case 'getScoutSummary':          return getScoutSummary(params);
    case 'getStoreSettings':         return getStoreSettings(params);
    case 'saveStoreSettings':        return saveStoreSettings(params);
    case 'verifyTokenAction':        return verifyTokenAction(params);
    case 'sendLineMessage':          return sendLineMessage(params);
    default:
      console.warn('未実装のaction:', action);
      return null;
  }
}

// ============================================================
// クライアントキャッシュ（速度改善）
// ============================================================
const _cache: Record<string, { data: any; at: number }> = {};
const CACHE_TTL: Record<string, number> = {
  getInitialData:  5 * 60 * 1000,
  getTherapists:   5 * 60 * 1000,
  getRoomMaster:   5 * 60 * 1000,
  getMenuMaster:   5 * 60 * 1000,
  getTherapistMaster: 5 * 60 * 1000,
};

export function apiGetCached(action: string, params: Record<string, any> = {}): Promise<any> {
  const ttl = CACHE_TTL[action];
  if (!ttl) return apiGet(action, params);
  const key = action + '_' + (window as any).STORE_ID + JSON.stringify(params);
  const cached = _cache[key];
  if (cached && Date.now() - cached.at < ttl) return Promise.resolve(cached.data);
  return apiGet(action, params).then((data: any) => {
    _cache[key] = { data, at: Date.now() };
    return data;
  });
}

export function clearCache(action?: string): void {
  if (action) {
    Object.keys(_cache).filter(k => k.startsWith(action)).forEach(k => delete _cache[k]);
  } else {
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }
}

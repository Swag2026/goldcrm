import { createContext, useContext, useEffect, useMemo, useState } from "react";

const en = {
  appName: "Gold Collections",
  appSub: "Customer balances & follow-ups",
  // nav
  navOverview: "Overview", navCustomers: "Customers", navMyDay: "My Day", navKpi: "Gold KPI", navUsers: "Users",
  // auth
  signIn: "Sign in", username: "Username", password: "Password", signingIn: "Signing in…", signOut: "Sign out",
  changePassword: "Change password", currentPassword: "Current password", newPassword: "New password (8+ chars)",
  save: "Save", cancel: "Cancel", close: "Close", saved: "Saved", loading: "Loading…", apply: "Apply", delete: "Delete",
  edit: "Edit", add: "Add", search: "Search", all: "All", none: "—", yes: "Yes", no: "No", error: "Something went wrong",
  // metals
  gold: "Gold", cash: "Cash", silver: "Silver", grams: "g", sar: "SAR",
  owesUs: "Owes us", weOwe: "We owe", settled: "Settled",
  debit: "Debit", credit: "Credit", balance: "Balance",
  // overview
  goldReceivable: "Gold owed to us", cashReceivable: "Cash owed to us", silverReceivable: "Silver owed to us",
  debtors: "Customers owing us", weOweTotal: "We owe", withBalance: "customers with a balance",
  followupsDue: "Follow-ups due", promisesPending: "Promises pending", promisesOverdue: "overdue",
  unassignedDebtors: "Unassigned debtors", promiseRate: "Promises kept / broken (30d)",
  topGold: "Top gold debtors", topCash: "Top cash debtors", trendTitle: "Gold owed to us — trend",
  activityTitle: "Follow-up activity (14 days)", noData: "No data yet", syncedAt: "Synced", syncNow: "Sync now",
  syncing: "Syncing…", syncError: "Last sync failed", demoData: "DEMO DATA",
  // customers
  customers: "Customers", customer: "Customer", code: "Code", searchCustomers: "Search name or code…",
  fltWithBalance: "With balance", fltAll: "All customers", fltGold: "Owe gold", fltCash: "Owe cash",
  fltSilver: "Owe silver", fltWeOwe: "We owe them",
  assignedTo: "Assigned to", unassigned: "Unassigned", mine: "Mine", status: "Status",
  stActive: "Active", stHold: "On hold", stLegal: "Legal",
  lastFollowup: "Last follow-up", nextFollowup: "Next follow-up", promise: "Promise",
  exportExcel: "Export Excel", results: "results", selected: "selected", assignSelected: "Assign selected",
  noCustomers: "No customers match these filters.", assignedOk: "Assigned", takeIt: "Take it", unassign: "Unassign",
  // drawer
  balances: "Balances", notes: "Notes", notesHint: "Internal notes about this customer…",
  logFollowup: "Log follow-up", kind: "Type", outcome: "Outcome", note: "Note",
  kCall: "Call", kWhatsapp: "WhatsApp", kVisit: "Visit", kNote: "Note", kOther: "Other",
  oReached: "Reached", oNoAnswer: "No answer", oPromised: "Promised to pay", oRefused: "Refused", oPaid: "Paid", oOther: "Other",
  nextFollowupDate: "Next follow-up date", addPromise: "Customer made a payment promise", promiseDate: "Promise date",
  promiseGold: "Gold (g)", promiseCash: "Cash", promiseSilver: "Silver (g)", promiseNeedsAmount: "Enter at least one amount and a date",
  timeline: "History", noHistory: "No follow-ups yet.", by: "by",
  pKept: "Kept", pBroken: "Broken", pPending: "Pending", markKept: "Mark kept", markBroken: "Mark broken",
  confirmDelete: "Delete this entry?", due: "due",
  // my day
  myDayTitle: "My Day", scopeMine: "My customers", scopeAll: "Everyone",
  followupsToday: "Follow-ups due", promisesToday: "Promises due / this week", nothingDue: "Nothing due — nice work.",
  daysOverdue: "d overdue", dueToday: "Due today", unassignedTitle: "Debtors nobody owns yet",
  // kpi
  kpiTitle: "Gold & Silver KPI", from: "From", to: "To", branches: "Branch IDs (comma)",
  openGold: "Opening Gold (g)", openGoldCash: "Opening Gold (cash)", openSilver: "Opening Silver (g)",
  goldKpi: "Gold KPI", silverKpi: "Silver KPI", gramsMode: "Grams (24K)", cashMode: "Cash value",
  netSales: "Net Sales", netPurchase: "Net Purchase", current: "Current", netProfit: "Net Profit",
  sales: "Sales", purchase: "Purchase", purchases: "Purchases", cashSales: "Cash sales", dueSales: "Credit sales",
  internalSales: "Internal sales", returnsCash: "Returns — cash", returnsDue: "Returns — credit",
  cashPurchases: "Cash purchases", duePurchases: "Credit purchases", internalPurchases: "Internal purchases",
  missingCodes: "Accounts not returned by GERP (treated as 0)",
  // users
  usersTitle: "Users", newUser: "New user", fullName: "Full name", role: "Role", rAdmin: "Admin", rCollector: "Collector",
  active: "Active", disabled: "Disabled", resetPassword: "Reset password", createUser: "Create user",
  disable: "Disable", enable: "Enable",
  rolesHint: "Admins manage users and assignments. Collectors log follow-ups and promises.",
  language: "العربية", theme: "Theme",
  // dashboard v2
  greetMorning: "Good morning", greetAfternoon: "Good afternoon", greetEvening: "Good evening",
  overviewSub: "Here is where the money stands today.", since: "since", vsPrev: "vs", noHistoryYet: "Change tracking starts after tomorrow's sync",
  debtorsDelta: "debtors", paidDownTitle: "Paid down", paidDownHint: "Balances that went down since the last day",
  paidDown: "Paid down", newDebt: "New / grown debt", historyBuilds: "History builds up after each day's sync.",
  trendTitle2: "Receivable trend (30 days)", attentionTitle: "Needs attention",
  tabFollowups: "Follow-ups", tabPromises: "Promises", tabNeglected: "Neglected", tabUnassigned: "Unassigned",
  neverContacted: "Never contacted", daysNoContact: "d no contact", allClear: "All clear here.",
  moversTitle: "Biggest movers", moversDown: "Paid down", moversUp: "Grew",
  concentration: "Gold concentration", top5Share: "of gold is with the top 5 customers", others: "Others",
  boardTitle: "Collector board", colCollector: "Collector", colDebtors: "Debtors", colGoldOut: "Gold out",
  colCashOut: "Cash out", colF7: "Follow-ups (7d)", colOverdue: "Overdue", colKB: "Kept / broken",
  recentActivity: "Recent activity", noActivity: "No follow-ups logged yet.",
  historyTitle: "Balance history", changeSince: "Change since",
  statusMix: "Debtors by status", assignedDebtors: "assigned", viewAll: "View all",
};

const ar = {
  appName: "تحصيل الذهب",
  appSub: "أرصدة العملاء والمتابعات",
  navOverview: "نظرة عامة", navCustomers: "العملاء", navMyDay: "يومي", navKpi: "مؤشرات الذهب", navUsers: "المستخدمون",
  signIn: "تسجيل الدخول", username: "اسم المستخدم", password: "كلمة المرور", signingIn: "جارٍ الدخول…", signOut: "تسجيل الخروج",
  changePassword: "تغيير كلمة المرور", currentPassword: "كلمة المرور الحالية", newPassword: "كلمة المرور الجديدة (٨ أحرف+)",
  save: "حفظ", cancel: "إلغاء", close: "إغلاق", saved: "تم الحفظ", loading: "جارٍ التحميل…", apply: "تطبيق", delete: "حذف",
  edit: "تعديل", add: "إضافة", search: "بحث", all: "الكل", none: "—", yes: "نعم", no: "لا", error: "حدث خطأ ما",
  gold: "الذهب", cash: "النقد", silver: "الفضة", grams: "جم", sar: "ر.س",
  owesUs: "مدين لنا", weOwe: "علينا له", settled: "مسدد",
  debit: "مدين", credit: "دائن", balance: "الرصيد",
  goldReceivable: "ذهب مستحق لنا", cashReceivable: "نقد مستحق لنا", silverReceivable: "فضة مستحقة لنا",
  debtors: "عملاء مدينون لنا", weOweTotal: "علينا", withBalance: "عميل لديه رصيد",
  followupsDue: "متابعات مستحقة", promisesPending: "وعود قائمة", promisesOverdue: "متأخرة",
  unassignedDebtors: "مدينون بلا مسؤول", promiseRate: "وعود محققة / منقوضة (٣٠ يوم)",
  topGold: "أكبر المدينين بالذهب", topCash: "أكبر المدينين بالنقد", trendTitle: "الذهب المستحق لنا — الاتجاه",
  activityTitle: "نشاط المتابعة (١٤ يومًا)", noData: "لا توجد بيانات بعد", syncedAt: "آخر مزامنة", syncNow: "مزامنة الآن",
  syncing: "جارٍ المزامنة…", syncError: "فشلت آخر مزامنة", demoData: "بيانات تجريبية",
  customers: "العملاء", customer: "العميل", code: "الرمز", searchCustomers: "ابحث بالاسم أو الرمز…",
  fltWithBalance: "لديهم رصيد", fltAll: "كل العملاء", fltGold: "مدينون بالذهب", fltCash: "مدينون بالنقد",
  fltSilver: "مدينون بالفضة", fltWeOwe: "لهم رصيد علينا",
  assignedTo: "المسؤول", unassigned: "غير معيّن", mine: "عملائي", status: "الحالة",
  stActive: "نشط", stHold: "معلّق", stLegal: "قانوني",
  lastFollowup: "آخر متابعة", nextFollowup: "المتابعة القادمة", promise: "الوعد",
  exportExcel: "تصدير Excel", results: "نتيجة", selected: "محدد", assignSelected: "تعيين المحدد",
  noCustomers: "لا يوجد عملاء مطابقون.", assignedOk: "تم التعيين", takeIt: "استلام", unassign: "إلغاء التعيين",
  balances: "الأرصدة", notes: "ملاحظات", notesHint: "ملاحظات داخلية عن العميل…",
  logFollowup: "تسجيل متابعة", kind: "النوع", outcome: "النتيجة", note: "ملاحظة",
  kCall: "اتصال", kWhatsapp: "واتساب", kVisit: "زيارة", kNote: "ملاحظة", kOther: "أخرى",
  oReached: "تم الرد", oNoAnswer: "لا يرد", oPromised: "وعد بالسداد", oRefused: "رفض", oPaid: "سدّد", oOther: "أخرى",
  nextFollowupDate: "تاريخ المتابعة القادمة", addPromise: "العميل وعد بالسداد", promiseDate: "تاريخ الوعد",
  promiseGold: "ذهب (جم)", promiseCash: "نقد", promiseSilver: "فضة (جم)", promiseNeedsAmount: "أدخل مبلغًا واحدًا على الأقل وتاريخًا",
  timeline: "السجل", noHistory: "لا توجد متابعات بعد.", by: "بواسطة",
  pKept: "تم الوفاء", pBroken: "نُقض", pPending: "قائم", markKept: "تم الوفاء", markBroken: "نُقض الوعد",
  confirmDelete: "حذف هذا السجل؟", due: "مستحق",
  myDayTitle: "يومي", scopeMine: "عملائي", scopeAll: "الجميع",
  followupsToday: "متابعات مستحقة", promisesToday: "وعود مستحقة / هذا الأسبوع", nothingDue: "لا شيء مستحق — أحسنت.",
  daysOverdue: "يوم تأخير", dueToday: "مستحق اليوم", unassignedTitle: "مدينون لا مسؤول عنهم",
  kpiTitle: "مؤشرات الذهب والفضة", from: "من", to: "إلى", branches: "أرقام الفروع (بفاصلة)",
  openGold: "رصيد افتتاحي ذهب (جم)", openGoldCash: "رصيد افتتاحي ذهب (نقد)", openSilver: "رصيد افتتاحي فضة (جم)",
  goldKpi: "مؤشر الذهب", silverKpi: "مؤشر الفضة", gramsMode: "جرام (عيار ٢٤)", cashMode: "القيمة النقدية",
  netSales: "صافي المبيعات", netPurchase: "صافي المشتريات", current: "الحالي", netProfit: "صافي الربح",
  sales: "المبيعات", purchase: "المشتريات", purchases: "المشتريات", cashSales: "مبيعات نقدية", dueSales: "مبيعات آجلة",
  internalSales: "مبيعات داخلية", returnsCash: "مردودات — نقدي", returnsDue: "مردودات — آجل",
  cashPurchases: "مشتريات نقدية", duePurchases: "مشتريات آجلة", internalPurchases: "مشتريات داخلية",
  missingCodes: "حسابات لم يُرجعها النظام (تُحتسب صفرًا)",
  usersTitle: "المستخدمون", newUser: "مستخدم جديد", fullName: "الاسم الكامل", role: "الدور", rAdmin: "مدير", rCollector: "محصّل",
  active: "نشط", disabled: "معطّل", resetPassword: "إعادة تعيين كلمة المرور", createUser: "إنشاء مستخدم",
  disable: "تعطيل", enable: "تفعيل",
  rolesHint: "المدير يدير المستخدمين والتعيينات. المحصّل يسجّل المتابعات والوعود.",
  language: "English", theme: "المظهر",
  greetMorning: "صباح الخير", greetAfternoon: "مساء الخير", greetEvening: "مساء الخير",
  overviewSub: "هذا وضع المستحقات اليوم.", since: "منذ", vsPrev: "مقابل", noHistoryYet: "يبدأ تتبع التغيير بعد مزامنة الغد",
  debtorsDelta: "مدين", paidDownTitle: "تم سداده", paidDownHint: "الأرصدة التي انخفضت منذ آخر يوم",
  paidDown: "تم سداده", newDebt: "دين جديد / زاد", historyBuilds: "يتراكم السجل بعد مزامنة كل يوم.",
  trendTitle2: "اتجاه المستحقات (٣٠ يومًا)", attentionTitle: "يحتاج انتباهًا",
  tabFollowups: "المتابعات", tabPromises: "الوعود", tabNeglected: "المهملون", tabUnassigned: "بلا مسؤول",
  neverContacted: "لم يُتصل به", daysNoContact: "يوم بلا تواصل", allClear: "لا شيء هنا.",
  moversTitle: "أكبر التغيّرات", moversDown: "انخفض", moversUp: "ارتفع",
  concentration: "تركّز الذهب", top5Share: "من الذهب لدى أكبر ٥ عملاء", others: "أخرى",
  boardTitle: "لوحة المحصّلين", colCollector: "المحصّل", colDebtors: "المدينون", colGoldOut: "ذهب مستحق",
  colCashOut: "نقد مستحق", colF7: "متابعات (٧ أيام)", colOverdue: "متأخر", colKB: "وفى / نقض",
  recentActivity: "آخر النشاط", noActivity: "لا توجد متابعات مسجّلة بعد.",
  historyTitle: "سجل الرصيد", changeSince: "التغيّر منذ",
  statusMix: "المدينون حسب الحالة", assignedDebtors: "معيّن", viewAll: "عرض الكل",
};

const dicts = { en, ar };
const Ctx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("gc_lang") || "en");
  useEffect(() => {
    localStorage.setItem("gc_lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const value = useMemo(() => {
    const d = dicts[lang];
    return { lang, setLang, t: (k) => d[k] ?? en[k] ?? k, isAr: lang === "ar" };
  }, [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

import React, { useState, useEffect } from 'react';
import { AppHeader } from './components/AppHeader';
import { BottomDock, NavTab } from './components/BottomDock';
import { ServicesSheet } from './components/ServicesSheet';
import { PalmerChartModal } from './components/PalmerChartModal';
import { PatientFileModal } from './components/PatientFileModal';
import { AddCheckModal } from './components/AddCheckModal';
import { AddLabOrderModal } from './components/AddLabOrderModal';
import { AddPaymentModal } from './components/AddPaymentModal';
import { SyncNotificationToast } from './components/SyncNotificationToast';
import { LiveSyncSimulatorModal } from './components/LiveSyncSimulatorModal';
import { RoleSwitcherModal } from './components/RoleSwitcherModal';
import { BackupModal } from './components/BackupModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { FloatingNotificationBadge } from './components/FloatingNotificationBadge';
import { SupabaseTestModal } from './components/SupabaseTestModal';
import { TreatmentInvoiceModal } from './components/TreatmentInvoiceModal';
import { supabaseService } from './services/supabaseService';

// Views
import { DashboardView } from './components/views/DashboardView';
import { FinancialView } from './components/views/FinancialView';
import { AppointmentsView } from './components/views/AppointmentsView';
import { LabModuleView } from './components/views/LabModuleView';
import { ImplantModuleView } from './components/views/ImplantModuleView';
import { PatientsListView } from './components/views/PatientsListView';
import { AiAssistantView } from './components/views/AiAssistantView';
import { InventoryView } from './components/views/InventoryView';
import { RemindersView } from './components/views/RemindersView';
import { SettingsView } from './components/views/SettingsView';
import { XRayModuleView } from './components/views/XRayModuleView';
import { AnimatedGeminiBackground } from './components/AnimatedGeminiBackground';

// Mock Data, Types & Realtime Engine
import { INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_INVENTORY } from './data/mockData';
import { 
  Patient, Appointment, InventoryItem, SayadCheck, 
  LabOrder, PaymentRecord, ImplantStage, ToothSurface, 
  TreatmentType, ToothCondition, UserAccount, PlatformDevice, 
  SyncEvent, DentalPrescription 
} from './types/dental';
import { syncEngine, INITIAL_USERS, INITIAL_PLATFORMS } from './services/syncEngine';
import { DollarSign, Bell } from 'lucide-react';
import { formatToman } from './utils/jalali';
import { getLatestFileNumber, getNextFileNumber, recordLastFileNumber } from './utils/fileNumber';

export default function App() {
  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
      const saved = localStorage.getItem('minadental_patients');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PATIENTS;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    try {
      const saved = localStorage.getItem('minadental_appointments');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_APPOINTMENTS;
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('minadental_inventory');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_INVENTORY;
  });
  const [users, setUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [platforms, setPlatforms] = useState<PlatformDevice[]>(INITIAL_PLATFORMS);
  
  // Current active user (defaults to Secretary so secretary workflow is front and center)
  const [currentUser, setCurrentUser] = useState<UserAccount>(INITIAL_USERS[2]);

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [activeView, setActiveView] = useState<string>('home');

  // Modals State
  const [servicesMenuOpen, setServicesMenuOpen] = useState(false);
  const [palmerChartOpen, setPalmerChartOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [addCheckModalOpen, setAddCheckModalOpen] = useState(false);
  const [addLabOrderModalOpen, setAddLabOrderModalOpen] = useState(false);
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoicePatient, setInvoicePatient] = useState<Patient | null>(null);
  
  // Multi-User & Real-time Sync Modals
  const [liveSyncModalOpen, setLiveSyncModalOpen] = useState(false);
  const [roleSwitcherModalOpen, setRoleSwitcherModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [supabaseTestModalOpen, setSupabaseTestModalOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(3);

  // Sync notification toast
  const [activeSyncEvent, setActiveSyncEvent] = useState<SyncEvent | null>(null);

  // Doctor treatment alert for secretary
  const [doctorBillingAlert, setDoctorBillingAlert] = useState<{
    patientName: string;
    patientId: string;
    amount: number;
    treatment: string;
  } | null>(null);

  // Supabase Hydration and Real-Time Event Listener
  useEffect(() => {
    // 1. Initial hydration check
    supabaseService.getPatients().then(({ data }) => {
      if (data && data.length > 0) {
        setPatients(data);
      }
    });

    // 2. Real-time changes from Supabase tables
    const unsubRealtime = supabaseService.subscribeToChanges((table, eventType, record) => {
      syncEngine.broadcast({
        type: 'CLOUD_BACKUP_SAVED',
        performedBy: 'Supabase Realtime',
        role: 'admin',
        platform: 'Cloud Database',
        title: `به‌روزرسانی جدول ${table}`,
        description: `تغییر ${eventType} در سرور سوپابیس اعمال گردید.`
      });
    });

    // 3. Local mesh sync listener
    const unsubscribeMesh = syncEngine.onSyncEvent((event) => {
      setActiveSyncEvent(event);
      setTimeout(() => {
        setActiveSyncEvent((current) => (current?.id === event.id ? null : current));
      }, 5000);

      // If doctor registered a treatment, trigger instant billing notice for secretary
      if (event.type === 'TREATMENT_REGISTERED' && event.payload) {
        setDoctorBillingAlert({
          patientName: event.payload.patientName || 'بیمار',
          patientId: event.payload.patientId || 'pat-1',
          amount: event.payload.cost || 6500000,
          treatment: event.payload.treatment || 'درمان در یونیت'
        });
      }

      if (event.type === 'PAYMENT_COLLECTED') {
        setDoctorBillingAlert(null);
      }
    });

    return () => {
      unsubRealtime();
      unsubscribeMesh();
    };
  }, []);

  // Save changes to localStorage for 100% offline persistence
  useEffect(() => {
    try {
      localStorage.setItem('minadental_patients', JSON.stringify(patients));
    } catch (e) {
      console.error(e);
    }
  }, [patients]);

  useEffect(() => {
    try {
      localStorage.setItem('minadental_appointments', JSON.stringify(appointments));
    } catch (e) {
      console.error(e);
    }
  }, [appointments]);

  useEffect(() => {
    try {
      localStorage.setItem('minadental_inventory', JSON.stringify(inventory));
    } catch (e) {
      console.error(e);
    }
  }, [inventory]);

  // Daily Clinic Statistics
  const todayAppointmentsCount = appointments.filter(a => a.date.includes('۰۸/۱۵')).length;
  const activeSurgeriesCount = 3;
  const readyLabOrdersCount = patients.flatMap(p => p.labOrders).filter(l => l.status === 'ready_for_clinic').length;
  const dailyRevenue = 38500000;

  // Handlers
  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === 'home') setActiveView('home');
    if (tab === 'patients') setActiveView('patients');
    if (tab === 'treatments') setPalmerChartOpen(true);
    if (tab === 'financial') setActiveView('financial');
    if (tab === 'appointments') setActiveView('appointments');
  };

  const handleServicesNavigate = (viewId: string) => {
    if (viewId === 'palmer' || viewId === 'treatment_plans') {
      setPalmerChartOpen(true);
    } else if (['sayad_checks', 'installments', 'pos_payments', 'reports', 'guarantee_checks'].includes(viewId)) {
      setActiveView('financial');
      setActiveTab('financial');
    } else {
      setActiveView(viewId);
      if (['patients', 'appointments', 'financial'].includes(viewId)) {
        setActiveTab(viewId as NavTab);
      } else {
        setActiveTab('home');
      }
    }
  };

  // Add Treatment from Palmer Chart (Broadcast to secretary instantly!)
  const handleSaveTreatment = (treatmentData: {
    quadrant: 'UR' | 'UL' | 'LL' | 'LR';
    toothNumber: number;
    surfaces: ToothSurface[];
    treatment: TreatmentType;
    cost: number;
    notes: string;
  }) => {
    const targetPatient = selectedPatient || patients[0];
    if (!targetPatient) return;

    const toothKey = `${treatmentData.quadrant}_${treatmentData.toothNumber}`;

    const newCondition: ToothCondition = {
      quadrant: treatmentData.quadrant,
      toothNumber: treatmentData.toothNumber,
      surfaces: treatmentData.surfaces,
      treatment: treatmentData.treatment,
      status: 'in_progress',
      notes: treatmentData.notes,
      cost: treatmentData.cost,
      date: '۱۴۰۳/۰۸/۱۵'
    };

    const updatedPatients = patients.map(p => {
      if (p.id === targetPatient.id) {
        return {
          ...p,
          totalCost: p.totalCost + treatmentData.cost,
          balance: p.balance - treatmentData.cost,
          activeTreatmentsCount: p.activeTreatmentsCount + 1,
          teethConditions: {
            ...p.teethConditions,
            [toothKey]: newCondition
          }
        };
      }
      return p;
    });

    setPatients(updatedPatients);
    if (selectedPatient && selectedPatient.id === targetPatient.id) {
      setSelectedPatient(updatedPatients.find(p => p.id === targetPatient.id) || null);
    }

    // Broadcast live event across all platforms
    syncEngine.broadcast({
      type: 'TREATMENT_REGISTERED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: `درمان دندان ${treatmentData.toothNumber} ثبت شد`,
      description: `پزشک درمان دندان ${treatmentData.toothNumber} (مبلغ ${formatToman(treatmentData.cost)}) را برای ${targetPatient.fullName} ثبت کرد.`,
      actionRequired: 'منشی می‌تواند فوراً فیش صادر و تسویه کند',
      payload: {
        patientId: targetPatient.id,
        patientName: targetPatient.fullName,
        treatment: treatmentData.treatment,
        cost: treatmentData.cost
      }
    });
  };

  // Add Sayad Check
  const handleAddCheck = (newCheck: SayadCheck) => {
    const updated = patients.map(p => {
      if (p.id === newCheck.patientId) {
        return {
          ...p,
          sayadChecks: [newCheck, ...p.sayadChecks]
        };
      }
      return p;
    });
    setPatients(updated);
    if (selectedPatient && selectedPatient.id === newCheck.patientId) {
      setSelectedPatient(updated.find(p => p.id === newCheck.patientId) || null);
    }

    // Persist to Supabase Cloud
    supabaseService.saveSayadCheck(newCheck);

    syncEngine.broadcast({
      type: 'CHECK_REGISTERED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'چک صیادی جدید ثبت شد',
      description: `چک ${formatToman(newCheck.amount)} بابت بیمار ${newCheck.patientName} در سامانه صیاد ثبت گردید.`
    });
  };

  // Add Lab Order
  const handleAddLabOrder = (newOrder: LabOrder) => {
    const updated = patients.map(p => {
      if (p.id === newOrder.patientId) {
        return {
          ...p,
          labOrders: [newOrder, ...p.labOrders]
        };
      }
      return p;
    });
    setPatients(updated);
    if (selectedPatient && selectedPatient.id === newOrder.patientId) {
      setSelectedPatient(updated.find(p => p.id === newOrder.patientId) || null);
    }

    // Persist to Supabase Cloud
    supabaseService.saveLabOrder(newOrder);

    syncEngine.broadcast({
      type: 'LAB_DISPATCHED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'سفارش پروتز به لابراتوار ارسال شد',
      description: `${newOrder.workType} برای ${newOrder.patientName} به ${newOrder.labName} ارسال گردید.`
    });
  };

  // Add Payment (Immediately syncs across all devices)
  const handleAddPayment = (newPayment: PaymentRecord) => {
    const updated = patients.map(p => {
      if (p.id === newPayment.patientId) {
        return {
          ...p,
          paidAmount: p.paidAmount + newPayment.amount,
          balance: p.balance + newPayment.amount,
          payments: [newPayment, ...p.payments]
        };
      }
      return p;
    });
    setPatients(updated);
    if (selectedPatient && selectedPatient.id === newPayment.patientId) {
      setSelectedPatient(updated.find(p => p.id === newPayment.patientId) || null);
    }

    setDoctorBillingAlert(null);

    syncEngine.broadcast({
      type: 'PAYMENT_COLLECTED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'وجه در صندوق تسویه شد',
      description: `مبلغ ${formatToman(newPayment.amount)} از بیمار ${newPayment.patientName} دریافت و در کلینیک ثبت شد.`
    });
  };

  // Advance Implant Stage
  const handleAdvanceImplantStage = (caseId: string, nextStage: ImplantStage) => {
    const updated = patients.map(p => {
      const hasCase = p.implantCases.some(c => c.id === caseId);
      if (hasCase) {
        return {
          ...p,
          implantCases: p.implantCases.map(c => c.id === caseId ? { ...c, currentStage: nextStage } : c)
        };
      }
      return p;
    });
    setPatients(updated);

    syncEngine.broadcast({
      type: 'IMPLANT_UPDATED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'مرحله ایمپلنت تغییر یافت',
      description: `کیس ایمپلنت به مرحله ${nextStage} ارتقا یافت.`
    });
  };

  // Update Lab Status
  const handleUpdateLabStatus = (orderId: string, status: any) => {
    const updated = patients.map(p => {
      const hasOrder = p.labOrders.some(o => o.id === orderId);
      if (hasOrder) {
        return {
          ...p,
          labOrders: p.labOrders.map(o => o.id === orderId ? { ...o, status } : o)
        };
      }
      return p;
    });
    setPatients(updated);
  };

  // Add Appointment (Instantly synced)
  const handleAddAppointment = (newAptData: Omit<Appointment, 'id'>) => {
    const newApt: Appointment = {
      ...newAptData,
      id: `apt-${Date.now()}`
    };
    setAppointments([newApt, ...appointments]);

    // Persist to Supabase Cloud
    supabaseService.saveAppointment(newApt);

    syncEngine.broadcast({
      type: 'APPOINTMENT_SCHEDULED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'نوبت جدید ثبت شد',
      description: `نوبت ساعت ${newAptData.time} برای ${newAptData.patientName} در ${newAptData.unit} با موفقیت ثبت شد.`
    });
  };

  // Update Appointment Status
  const handleUpdateAppointmentStatus = (id: string, status: Appointment['status']) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status } : a));
  };

  // Add New Patient (Manual file number support & auto-incrementation)
  const handleAddNewPatient = (newPat: any) => {
    const finalFileNumber = newPat.fileNumber || getNextFileNumber(getLatestFileNumber(patients));
    recordLastFileNumber(finalFileNumber);

    const created: Patient = {
      ...newPat,
      id: `pat-${Date.now()}`,
      fileNumber: finalFileNumber,
      totalCost: 0,
      paidAmount: 0,
      balance: 0,
      activeTreatmentsCount: 0,
      lastVisit: '۱۴۰۳/۰۸/۱۵',
      teethConditions: {},
      sayadChecks: [],
      installments: [],
      labOrders: [],
      implantCases: [],
      payments: []
    };
    setPatients([created, ...patients]);
    setSelectedPatient(created);

    // Persist to Supabase Cloud
    supabaseService.savePatient(created);

    syncEngine.broadcast({
      type: 'TREATMENT_REGISTERED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'پرونده بیمار جدید تشکیل شد',
      description: `بیمار ${created.fullName} با شماره پرونده ${created.fileNumber} ثبت گردید.`
    });
  };

  // Update Patient File Number (Manual edit, updates auto-increment baseline)
  const handleUpdatePatientFileNumber = (patientId: string, newFileNumber: string) => {
    const trimmed = newFileNumber.trim();
    if (!trimmed) return;

    recordLastFileNumber(trimmed);

    const updated = patients.map(p => {
      if (p.id === patientId) {
        return { ...p, fileNumber: trimmed };
      }
      return p;
    });

    setPatients(updated);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient({ ...selectedPatient, fileNumber: trimmed });
    }

    syncEngine.broadcast({
      type: 'TREATMENT_REGISTERED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'شماره پرونده بیمار ویرایش شد',
      description: `شماره پرونده به ${trimmed} تغییر یافت و دنباله نوبت‌دهی خودکار از این شماره ادامه می‌یابد.`
    });
  };

  // Open Official Treatment Invoice Modal
  const handleOpenInvoice = (patient: Patient) => {
    setInvoicePatient(patient);
    setInvoiceModalOpen(true);
  };

  // Update specific treatment status (planned, in_progress, completed)
  const handleUpdateTreatmentStatus = (patientId: string, toothKey: string, status: ToothCondition['status']) => {
    const updated = patients.map(p => {
      if (p.id === patientId && p.teethConditions[toothKey]) {
        return {
          ...p,
          teethConditions: {
            ...p.teethConditions,
            [toothKey]: {
              ...p.teethConditions[toothKey],
              status
            }
          }
        };
      }
      return p;
    });
    setPatients(updated);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updated.find(p => p.id === patientId) || null);
    }
  };

  // Add Dental Prescription to Patient File
  const handleAddPrescription = (patientId: string, newRx: DentalPrescription) => {
    const updated = patients.map(p => {
      if (p.id === patientId) {
        return {
          ...p,
          prescriptions: [newRx, ...(p.prescriptions || [])]
        };
      }
      return p;
    });
    setPatients(updated);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updated.find(p => p.id === patientId) || null);
    }
  };

  // Toggle Patient Legal Consent
  const handleToggleConsent = (patientId: string, consentId: string) => {
    const updated = patients.map(p => {
      if (p.id === patientId) {
        const existing = p.consents || [];
        const found = existing.find(c => c.id === consentId);
        const nextConsents = found
          ? existing.map(c => c.id === consentId ? { ...c, isConfirmed: !c.isConfirmed } : c)
          : [...existing, { id: consentId, patientId, procedureType: 'general' as const, title: 'رضایت‌نامه درمان', signedDate: '۱۴۰۳/۰۸/۱۵', isConfirmed: true }];
        return {
          ...p,
          consents: nextConsents
        };
      }
      return p;
    });
    setPatients(updated);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updated.find(p => p.id === patientId) || null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-start overflow-x-hidden relative selection:bg-cyan-500 selection:text-black">
      
      {/* Animated Gemini Multi-Color Aurora Background Tailored to Each Section */}
      <AnimatedGeminiBackground activeView={activeView} />

      {/* Main Responsive App Container */}
      <div className="w-full max-w-lg md:max-w-2xl lg:max-w-4xl min-h-screen relative flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.06)] border-x border-slate-200/60 z-10">
        
        {/* Top Header with MinaDental Logo, Persian Clock, Wifi/Antenna, Cloud Auto-Sync and Reminders Bell */}
        <AppHeader
          title={
            activeView === 'financial' ? 'مدیریت مالی و چک' :
            activeView === 'appointments' ? 'نوبت‌دهی تقویم' :
            activeView === 'patients' ? 'پرونده بیماران' :
            activeView === 'lab' ? 'لابراتوار پروتز' :
            activeView === 'implant' ? 'کاشت ایمپلنت' :
            activeView === 'ai_assistant' ? 'هوش مصنوعی' :
            activeView === 'inventory' ? 'انبار و متریال' :
            activeView === 'reminders' ? 'پیامک و یادآوری' :
            activeView === 'settings' ? 'تنظیمات' : undefined
          }
          currentUser={currentUser}
          showBack={activeView !== 'home'}
          unreadRemindersCount={unreadNotificationsCount}
          onBack={() => {
            setActiveView('home');
            setActiveTab('home');
          }}
          onOpenProfile={() => setRoleSwitcherModalOpen(true)}
          onOpenReminders={() => setNotificationDrawerOpen(true)}
          onOpenSupabaseTest={() => setSupabaseTestModalOpen(true)}
          onTriggerSync={async () => {
            // Instant real-time cloud broadcast handshake
            syncEngine.broadcast({
              type: 'TREATMENT_REGISTERED',
              performedBy: currentUser.username,
              role: currentUser.role,
              platform: currentUser.assignedPlatform,
              title: 'همگام‌سازی ابری مینادنتال انجام شد',
              description: 'کلیه داده‌های بیماران، نوبت‌ها و امور مالی در بستر ابری همگام گردید.'
            });
            return true;
          }}
        />

        {/* Floating Notification Handle on the Right Screen Edge (Only visible when unread > 0, Draggable along right border) */}
        <FloatingNotificationBadge
          unreadCount={unreadNotificationsCount}
          onClick={() => setNotificationDrawerOpen(true)}
        />

        {/* Live Synchronized Doctor Billing Alert for Secretary */}
        {doctorBillingAlert && (
          <div className="mx-4 my-2 p-3 rounded-2xl bg-gradient-to-r from-red-950/80 to-amber-950/80 border border-amber-500/50 text-white shadow-xl flex items-center justify-between gap-3 animate-bounce">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold shrink-0">
                  <DollarSign className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-xs font-black text-amber-300 block">
                    اعلام فوری پزشک در یونیت: درمان تمام شد!
                  </span>
                  <span className="text-[11px] text-white/80 mt-0.5 block">
                    بیمار {doctorBillingAlert.patientName} · {doctorBillingAlert.treatment} · {formatToman(doctorBillingAlert.amount)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setAddPaymentModalOpen(true)}
                className="py-1.5 px-3 rounded-xl bg-[#c8ff00] text-black font-extrabold text-xs shrink-0 shadow-md active:scale-95 transition-all"
              >
                دریافت وجه (POS)
              </button>
            </div>
          )}

          {/* Real-time Sync Toast Notification */}
          <SyncNotificationToast
            event={activeSyncEvent}
            onDismiss={() => setActiveSyncEvent(null)}
            onActionClick={(event) => {
              if (event.type === 'TREATMENT_REGISTERED') setAddPaymentModalOpen(true);
              if (event.type === 'APPOINTMENT_SCHEDULED') setActiveView('appointments');
            }}
          />

          {/* View Routing */}
          <main className="flex-1">
            {activeView === 'home' && (
              <DashboardView
                patients={patients}
                onSelectPatient={(p) => setSelectedPatient(p)}
                onOpenPalmerForPatient={(p) => {
                  setSelectedPatient(p);
                  setPalmerChartOpen(true);
                }}
                onOpenAppointmentForPatient={(p) => {
                  setSelectedPatient(p);
                  setActiveView('appointments');
                  setActiveTab('appointments');
                }}
                onNavigate={handleServicesNavigate}
                onOpenPalmerChart={() => setPalmerChartOpen(true)}
                onQuickAdmission={() => setActiveView('patients')}
                onOpenSupabaseTest={() => setSupabaseTestModalOpen(true)}
                todayAppointmentsCount={todayAppointmentsCount}
                activeSurgeriesCount={activeSurgeriesCount}
                readyLabOrdersCount={readyLabOrdersCount}
                dailyRevenue={dailyRevenue}
              />
            )}

            {activeView === 'financial' && (
              <FinancialView
                patients={patients}
                onOpenCheckModal={() => setAddCheckModalOpen(true)}
                onOpenPatientFile={(p) => setSelectedPatient(p)}
                onOpenPaymentModal={() => setAddPaymentModalOpen(true)}
                onOpenInvoice={handleOpenInvoice}
              />
            )}

            {activeView === 'appointments' && (
              <AppointmentsView
                appointments={appointments}
                patients={patients}
                onAddAppointment={handleAddAppointment}
                onUpdateStatus={handleUpdateAppointmentStatus}
              />
            )}

            {activeView === 'lab' && (
              <LabModuleView
                patients={patients}
                onOpenPatientFile={(p) => setSelectedPatient(p)}
                onAddLabOrder={() => setAddLabOrderModalOpen(true)}
                onUpdateStatus={handleUpdateLabStatus}
              />
            )}

            {activeView === 'implant' && (
              <ImplantModuleView
                patients={patients}
                onOpenPatientFile={(p) => setSelectedPatient(p)}
                onAdvanceStage={handleAdvanceImplantStage}
                onAddImplantCase={(newCase) => {
                  setPatients(patients.map(p => p.id === newCase.patientId ? {
                    ...p,
                    implantCases: [newCase, ...(p.implantCases || [])]
                  } : p));
                }}
              />
            )}

            {activeView === 'patients' && (
              <PatientsListView
                patients={patients}
                onOpenPatientFile={(p) => setSelectedPatient(p)}
                onAddNewPatient={handleAddNewPatient}
                onUpdateFileNumber={handleUpdatePatientFileNumber}
              />
            )}

            {activeView === 'ai_assistant' && (
              <AiAssistantView />
            )}

            {activeView === 'inventory' && (
              <InventoryView
                inventory={inventory}
                onUpdateStock={(id, newStock) => {
                  setInventory(inventory.map(i => i.id === id ? { ...i, stock: newStock } : i));
                }}
                onAddItem={(item) => setInventory([item, ...inventory])}
              />
            )}

            {activeView === 'reminders' && (
              <RemindersView />
            )}

            {activeView === 'xrays' && (
              <XRayModuleView
                patients={patients}
                onOpenPatientFile={(p) => setSelectedPatient(p)}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView onOpenSupabaseTest={() => setSupabaseTestModalOpen(true)} />
            )}
          </main>

          {/* Bottom Dock Navigation Bar (Persistent across all screens) */}
          <BottomDock
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onOpenServicesMenu={() => setServicesMenuOpen(true)}
          />

          {/* Screenshot 1: Full Services Sheet Modal */}
          <ServicesSheet
            isOpen={servicesMenuOpen}
            onClose={() => setServicesMenuOpen(false)}
            onNavigate={handleServicesNavigate}
          />

          {/* 3D Palmer Dental Chart & Surface Picker Modal */}
          <PalmerChartModal
            isOpen={palmerChartOpen}
            onClose={() => setPalmerChartOpen(false)}
            patientName={selectedPatient?.fullName || 'بیمار جدید / پیش‌فرض'}
            onSaveTreatment={handleSaveTreatment}
          />

          {/* Comprehensive Patient Record File Modal */}
          <PatientFileModal
            patient={selectedPatient}
            isOpen={!!selectedPatient}
            onClose={() => setSelectedPatient(null)}
            onOpenPalmerChart={() => setPalmerChartOpen(true)}
            onAddCheck={() => setAddCheckModalOpen(true)}
            onAddPayment={() => setAddPaymentModalOpen(true)}
            onAddLabOrder={() => setAddLabOrderModalOpen(true)}
            onOpenXRayModule={() => setActiveView('xrays')}
            onUpdateFileNumber={handleUpdatePatientFileNumber}
            onOpenInvoice={handleOpenInvoice}
            onUpdateTreatmentStatus={handleUpdateTreatmentStatus}
            onAddPrescription={handleAddPrescription}
            onToggleConsent={handleToggleConsent}
          />

          {/* Printable Official Dental Clinic Invoice Modal */}
          <TreatmentInvoiceModal
            isOpen={invoiceModalOpen}
            onClose={() => setInvoiceModalOpen(false)}
            patient={invoicePatient || selectedPatient || patients[0]}
          />

          {/* Sayad & Guarantee Check Creation Modal */}
          <AddCheckModal
            isOpen={addCheckModalOpen}
            onClose={() => setAddCheckModalOpen(false)}
            patients={patients}
            onAddCheck={handleAddCheck}
          />

          {/* Lab Order Dispatch Modal */}
          <AddLabOrderModal
            isOpen={addLabOrderModalOpen}
            onClose={() => setAddLabOrderModalOpen(false)}
            patients={patients}
            onAddOrder={handleAddLabOrder}
          />

          {/* POS & Cash Payment Modal */}
          <AddPaymentModal
            isOpen={addPaymentModalOpen}
            onClose={() => setAddPaymentModalOpen(false)}
            patients={patients}
            onAddPayment={handleAddPayment}
          />

          {/* Live Dual-Platform Secretary & Doctor Simulator Modal */}
          <LiveSyncSimulatorModal
            isOpen={liveSyncModalOpen}
            onClose={() => setLiveSyncModalOpen(false)}
            patients={patients}
            appointments={appointments}
            onSecretaryBookAppointment={(name: string, time: string) => {
              handleAddAppointment({
                patientId: 'pat-new',
                patientName: name,
                phone: '۰۹۱۲۳۴۵۶۷۸۹',
                unit: 'یونیت ۱',
                doctor: 'دکتر مهدی امیری',
                date: '۱۴۰۳/۰۸/۱۵',
                time,
                durationMinutes: 45,
                treatment: 'معاینه و طرح درمان',
                status: 'scheduled'
              });
            }}
            onDoctorRegisterTreatment={(patientId: string, _tooth: string, _treatmentName: string, cost: number) => {
              const p = patients.find(pat => pat.id === patientId) || patients[0];
              setSelectedPatient(p);
              handleSaveTreatment({
                quadrant: 'UR',
                toothNumber: 5,
                surfaces: ['occlusal', 'buccal'],
                treatment: 'crown_zirconia',
                cost,
                notes: 'روکش تمام زیرکونیا تراش و قالب‌گیری شد'
              });
            }}
            onSecretaryCollectPayment={(patientId: string, amount: number) => {
              handleAddPayment({
                id: `pay-${Date.now()}`,
                patientId,
                patientName: 'علی مرادی',
                amount,
                date: '۱۴۰۳/۰۸/۱۵',
                method: 'pos',
                referenceNumber: '۷۲۸۴۹۱۲۸',
                terminalName: 'کارتخوان پذیرش مطب (به‌پرداخت ملت)',
                forTreatment: 'تسویه روکش زیرکونیا'
              });
            }}
          />

          {/* Role and Connected Platform Switcher Modal */}
          <RoleSwitcherModal
            isOpen={roleSwitcherModalOpen}
            onClose={() => setRoleSwitcherModalOpen(false)}
            currentUser={currentUser}
            users={users}
            platforms={platforms}
            onSwitchUser={(user) => setCurrentUser(user)}
            onAddPlatform={(platform) => setPlatforms([...platforms, platform])}
          />

          {/* Cloud and Local Backup & Restore Modal */}
          <BackupModal
            isOpen={backupModalOpen}
            onClose={() => setBackupModalOpen(false)}
            clinicName="مرکز تخصصی دندانپزشکی مینادنتال"
            patients={patients}
            appointments={appointments}
            inventory={inventory}
            users={users}
            platforms={platforms}
            onRestoreData={(restored) => {
              if (restored.patients) setPatients(restored.patients);
              if (restored.appointments) setAppointments(restored.appointments);
              if (restored.inventory) setInventory(restored.inventory);
            }}
          />

          {/* World-Class Slide-over Notification & Reminders Drawer */}
          <NotificationDrawer
            isOpen={notificationDrawerOpen}
            onClose={() => setNotificationDrawerOpen(false)}
            onNavigateToModule={handleServicesNavigate}
            onUnreadCountChange={setUnreadNotificationsCount}
          />

          {/* Supabase Realtime Cloud DB & Diagnostic Test Suite Modal */}
          <SupabaseTestModal
            isOpen={supabaseTestModalOpen}
            onClose={() => setSupabaseTestModalOpen(false)}
          />

        </div>
      </div>
  );
}

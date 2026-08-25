"use client";

import { useState, useEffect } from "react";
import { X, 
  Plus, Search, User, Calendar, Building2, RefreshCw, Star, 
  Briefcase, IndianRupee, Trash2, Edit2, MapPin, Landmark,
  ChevronRight, ChevronLeft, CheckCircle2, Upload, FileText,
  CreditCard, Smartphone, ShieldCheck, Heart, UserPlus,
  Clock, Lock, Users
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { clsx } from "clsx";

interface Employee {
  id: string;
  userId: string;
  employeeCode: string;
  department?: string;
  designation?: string;
  dateOfJoining: string;
  user: { fullName: string; email: string; phone?: string };
  salaryStructure?: { name: string };
  salaryStructureId?: string | null;
  salary?: number;
  gender?: string;
  address?: string;
  bankAccount?: string;
  ifscCode?: string;
  panNumber?: string;
  pfNumber?: string;
  esiNumber?: string;
}

const EMPTY_FORM = {
  // Step 1: Basic Details
  userId: "",
  fullName: "",
  employeeCode: "",
  gender: "",
  dob: "",
  mobile: "",
  altMobile: "",
  personalEmail: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  bloodGroup: "",
  maritalStatus: "",
  profilePhoto: null,

  // Step 2: Address Information
  permDoorNo: "",
  permStreet: "",
  permArea: "",
  permCity: "",
  permDistrict: "",
  permState: "",
  permPincode: "",
  currentAddress: "",
  currentCity: "",
  currentState: "",
  currentPincode: "",

  // Step 3: Government & Identity
  aadhaarNumber: "",
  panNumber: "",
  hasAadhaar: false,
  hasPan: false,
  hasVoterId: false,
  hasDrivingLicense: false,
  hasPassport: false,
  verificationStatus: "PENDING",

  // Step 4: Bank & Salary
  bankAccountHolder: "",
  bankName: "",
  bankBranch: "",
  bankAccountNumber: "",
  ifscCode: "",
  upiId: "",
  salaryType: "Monthly",
  salary: "",
  allowances: "",
  incentives: "",
  isOvertimeEligible: false,
  pfDeduction: "",
  esiDeduction: "",
  paymentMethod: "Bank Transfer",
  salaryCreditDate: "",

  // Step 5: Department & Work Information
  department: "",
  designation: "",
  reportingManager: "",
  shiftTiming: "",
  workLocation: "",
  employeeType: "Permanent", // Permanent, Contract, Intern, Temporary
  hasErpAccess: false,
  hasAttendanceAccess: false,
  hasPayrollAccess: false,
  hasLeaveAccess: false,
  
  dateOfJoining: ""
};

export default function EmployeesClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [structures, setStructures] = useState<any[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [empRes, userRes, structRes] = await Promise.all([
        api.get("/api/employees", { params: { search, department: departmentFilter } }),
        api.get("/api/users"),
        api.get("/api/payroll/structures").catch(() => ({ data: [] }))
      ]);
      setEmployees(empRes.data);
      setUsers(userRes.data);
      setStructures(structRes.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleAssignStructure(employeeId: string, salaryStructureId: string) {
    setAssigningId(employeeId);
    try {
      await api.patch(`/api/employees/${employeeId}`, { salaryStructureId: salaryStructureId || null });
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setAssigningId(null);
    }
  }

  useEffect(() => {
    loadData();
  }, [search, departmentFilter]);

  const handleOpenForm = (emp: Employee | null = null) => {
    if (emp) {
      setSelectedEmployee(emp);
      setForm({
        ...EMPTY_FORM,
        userId: emp.userId,
        department: emp.department || "",
        designation: emp.designation || "",
        dateOfJoining: emp.dateOfJoining ? new Date(emp.dateOfJoining).toISOString().split('T')[0] : "",
        gender: emp.gender || "",
        currentAddress: emp.address || "",
        bankAccountNumber: emp.bankAccount || "",
        ifscCode: emp.ifscCode || "",
        panNumber: emp.panNumber || "",
        pfDeduction: emp.pfNumber || "",
        esiDeduction: emp.esiNumber || "",
        salary: emp.salary ? String(emp.salary) : ""
      });
    } else {
      setSelectedEmployee(null);
      setForm(EMPTY_FORM);
    }
    setFormStep(1);
    setShowForm(true);
  };

  async function handleSubmit() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        salary: form.salary ? Number(form.salary) : undefined,
        address: form.currentAddress || form.permCity,
        bankAccount: form.bankAccountNumber,
        pfNumber: form.pfDeduction,
        esiNumber: form.esiDeduction
      };

      if (selectedEmployee) {
        await api.patch(`/api/employees/${selectedEmployee.id}`, payload);
      } else {
        await api.post("/api/employees", payload);
      }
      setShowForm(false);
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));
  const selectedUser = users.find(u => u.id === form.userId);

  const [stepError, setStepError] = useState<string | null>(null);

  const validateStep = () => {
    if (formStep === 1) {
      if (!form.fullName) return "Full name is required";
      if (!form.employeeCode) return "Employee code is required";
      if (!form.mobile) return "Mobile number is required";
    }
    if (formStep === 2) {
      if (!form.permCity) return "City is required";
      if (!form.permState) return "State is required";
      if (!form.permPincode) return "Pincode is required";
    }
    if (formStep === 3) {
      if (!form.aadhaarNumber) return "Aadhaar number is required";
      if (!form.panNumber) return "PAN number is required";
    }
    if (formStep === 4) {
      if (!form.bankAccountNumber) return "Bank account number is required";
      if (!form.ifscCode) return "IFSC code is required";
      if (!form.salary) return "Basic salary is required";
    }
    if (formStep === 5) {
      if (!form.department) return "Department is required";
      if (!form.designation) return "Designation is required";
      if (!form.dateOfJoining) return "Joining date is required";
    }
    return null;
  };

  const nextStep = () => {
    const error = validateStep();
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);
    setFormStep(s => Math.min(s + 1, 5));
  };
  const prevStep = () => {
    setStepError(null);
    setFormStep(s => Math.max(s - 1, 1));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 p-2 sm:p-1">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 pb-2 border-b border-slate-200 dark:border-white/10">
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={loadData} className="p-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 transition-colors">
            <RefreshCw size={16} className={clsx("text-gray-400", loading && "animate-spin")} />
          </button>
          <Link href="/hr/leaves" className="border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center">
            Leaves
          </Link>
          <button onClick={() => handleOpenForm()} className="bg-orange-600 text-white px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-orange-500/20 hover:bg-orange-700 transition-all">
            <Plus size={16} /> Add Employee
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white/70 dark:bg-card/70 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/5 p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl"><User size={20} className="text-orange-500" /></div>
            <div>
              <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Employees</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{employees.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50/70 dark:bg-purple-500/10 rounded-2xl border border-purple-100 dark:border-purple-500/20 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-500/20 rounded-xl"><Briefcase size={20} className="text-purple-500" /></div>
            <div>
              <p className="text-[10px] sm:text-[11px] font-black text-purple-600/70 uppercase tracking-widest">Departments</p>
              <p className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-400 mt-1">{departments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-emerald-50/70 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl"><IndianRupee size={20} className="text-emerald-500" /></div>
            <div>
              <p className="text-[10px] sm:text-[11px] font-black text-emerald-600/70 uppercase tracking-widest">Active Payroll</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">{employees.filter(e => e.salaryStructure).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-indigo-50/70 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl"><Calendar size={20} className="text-indigo-600" /></div>
            <div>
              <p className="text-[10px] sm:text-[11px] font-black text-indigo-600/70 uppercase tracking-widest">New Joiners</p>
              <p className="text-xl sm:text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1">
                {employees.filter(e => {
                  const joinDate = new Date(e.dateOfJoining);
                  const monthAgo = new Date();
                  monthAgo.setMonth(monthAgo.getMonth() - 1);
                  return joinDate > monthAgo;
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search by name, code..." 
            className="w-full pl-9 pr-4 py-3 text-sm bg-white dark:bg-card border border-gray-200 rounded-xl outline-none focus:ring-4 ring-orange-500/5 transition-all" 
          />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
        </div>
        <select 
          value={departmentFilter} 
          onChange={(e) => setDepartmentFilter(e.target.value)} 
          className="px-3 py-3 text-sm bg-white dark:bg-card border border-gray-200 rounded-xl font-bold outline-none focus:ring-4 ring-orange-500/5 transition-all appearance-none cursor-pointer min-w-[150px]"
        >
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d!}>{d}</option>)}
        </select>
      </div>

      {/* Employee Cards Grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {loading && employees.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">Loading Employees...</div>
        ) : employees.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">No employees found</div>
        ) : employees.map((emp) => (
          <div 
            key={emp.id} 
            className="bg-white dark:bg-[#12141c] rounded-[2rem] sm:rounded-3xl border border-gray-100 dark:border-white/5 p-4 sm:p-6 hover:shadow-xl transition-all group overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-[100px] -mr-8 -mt-8" />
            
            <div className="flex items-start gap-4 mb-5 relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
                <User size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate uppercase">{emp.user.fullName}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] sm:text-[10px] font-black text-orange-500 uppercase tracking-tighter bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-md">{emp.employeeCode}</span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">• {emp.designation || "No Designation"}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0 bg-gray-50 dark:bg-white/5 p-1 rounded-xl">
                <button onClick={() => handleOpenForm(emp)} className="p-2 text-gray-400 hover:text-orange-500 transition-colors"><Edit2 size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col justify-center">
                <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Dept.</p>
                <p className="text-xs sm:text-sm font-bold truncate">{emp.department || "—"}</p>
              </div>
              <div className="bg-indigo-50/30 dark:bg-indigo-500/5 p-2 rounded-xl border border-indigo-100 dark:border-indigo-500/10 flex flex-col justify-center">
                <p className="text-[8px] sm:text-[9px] font-bold text-indigo-600 uppercase tracking-tighter mb-0.5">Joined</p>
                <p className="text-xs sm:text-sm font-bold truncate">{new Date(emp.dateOfJoining).toLocaleDateString()}</p>
              </div>
              <div className="bg-emerald-50/30 dark:bg-emerald-500/5 p-2 rounded-xl border border-emerald-100 dark:border-emerald-500/10 flex flex-col justify-center">
                <p className="text-[8px] sm:text-[9px] font-bold text-emerald-600 uppercase tracking-tighter mb-0.5">Salary</p>
                <p className="text-xs sm:text-sm font-bold truncate">₹{Number(emp.salary || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 flex items-center gap-2">
                <MapPin size={12} className="text-slate-400" />
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 truncate">{emp.address || "No address provided"}</p>
              </div>
              <div className="px-3 py-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 flex items-center gap-2">
                <Landmark size={12} className={clsx(emp.bankAccount ? "text-emerald-500" : "text-slate-300")} />
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">{emp.bankAccount ? "Bank Linked" : "No Bank"}</p>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-gray-50 dark:border-white/5 flex items-center justify-between gap-2">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase shrink-0">Salary Structure</p>
              <select
                value={emp.salaryStructureId || ""}
                disabled={assigningId === emp.id}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleAssignStructure(emp.id, e.target.value)}
                className="text-[9px] sm:text-[10px] font-black text-orange-600 uppercase tracking-widest bg-transparent border border-orange-100 dark:border-orange-500/20 rounded-lg px-2 py-1 outline-none max-w-[140px] truncate"
              >
                <option value="">Unassigned</option>
                {structures.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div 
            className="absolute inset-0" 
            onClick={() => setShowForm(false)} 
          />
          <div className="bg-white dark:bg-[#12141c] rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-3xl p-5 sm:p-8 my-auto relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  {selectedEmployee ? "Edit Employee" : "Add Employee"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                   <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <div key={s} className={clsx("w-4 sm:w-6 h-1 rounded-full transition-all", formStep >= s ? "bg-orange-500" : "bg-slate-200")} />
                      ))}
                   </div>
                   <p className="text-[9px] sm:text-[10px] font-black text-orange-600 uppercase tracking-widest ml-2">Step {formStep} of 5</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedEmployee && (
                  <span className="hidden sm:inline-block bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {selectedEmployee.employeeCode}
                  </span>
                )}
                <button 
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-6 max-h-[65vh] overflow-y-auto px-1">
              {/* Step 1: Basic Employee Details */}
              {formStep === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5 sm:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* 
                    <div className="md:col-span-1 flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-3xl bg-slate-50 dark:bg-white/5">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white dark:bg-card rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 mb-3">
                           <Upload size={20} className="text-slate-500" />
                        </div>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase">Profile Photo</p>
                        <input type="file" className="hidden" id="photo-upload" />
                        <label htmlFor="photo-upload" className="mt-2 text-[9px] sm:text-[10px] font-black text-orange-600 uppercase cursor-pointer hover:underline">Browse File</label>
                    </div>
                    */}
                    <div className="md:col-span-2 space-y-4 sm:space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Full Name *</label>
                          <input placeholder="Ex: John Doe" value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl font-semibold text-sm outline-none focus:border-orange-500 transition-colors" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Employee Code *</label>
                          <input placeholder="Ex: EMP001" value={form.employeeCode} onChange={(e) => setForm({...form, employeeCode: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl font-semibold text-sm outline-none focus:border-orange-500 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                      <select value={form.gender} onChange={(e) => setForm({...form, gender: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none appearance-none focus:border-orange-500 transition-colors">
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                      <input type="date" value={form.dob} onChange={(e) => setForm({...form, dob: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Mobile *</label>
                      <input 
                        placeholder="10 digits" 
                        value={form.mobile} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setForm({...form, mobile: val});
                        }} 
                        className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Alt. Contact</label>
                      <input 
                        placeholder="Optional" 
                        value={form.altMobile} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setForm({...form, altMobile: val});
                        }} 
                        className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Personal Email</label>
                      <input placeholder="email@example.com" value={form.personalEmail} onChange={(e) => setForm({...form, personalEmail: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Blood Group</label>
                      <input placeholder="Ex: O+" value={form.bloodGroup} onChange={(e) => setForm({...form, bloodGroup: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Marital Status</label>
                      <select value={form.maritalStatus} onChange={(e) => setForm({...form, maritalStatus: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none appearance-none focus:border-orange-500 transition-colors">
                        <option value="">Select...</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1">Emergency Contact Person</label>
                      <input placeholder="Name" value={form.emergencyContactName} onChange={(e) => setForm({...form, emergencyContactName: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-orange-100 rounded-xl text-sm font-semibold outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1">Emergency Number</label>
                      <input 
                        placeholder="Phone" 
                        value={form.emergencyContactPhone} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setForm({...form, emergencyContactPhone: val});
                        }} 
                        className="w-full px-4 py-2.5 bg-white border border-orange-100 rounded-xl text-sm font-semibold outline-none" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Address Information */}
              {formStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase flex items-center gap-2"><MapPin size={14} className="text-orange-500" /> Permanent Address</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Door No.</label>
                        <input value={form.permDoorNo} onChange={(e) => setForm({...form, permDoorNo: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                      </div>
                      <div className="col-span-1 md:col-span-3 space-y-1">
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Street Name</label>
                        <input value={form.permStreet} onChange={(e) => setForm({...form, permStreet: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                      </div>
                      <div className="col-span-2 md:col-span-2 space-y-1">
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Area / Locality</label>
                        <input value={form.permArea} onChange={(e) => setForm({...form, permArea: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">City *</label>
                        <input value={form.permCity} onChange={(e) => setForm({...form, permCity: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">District</label>
                        <input value={form.permDistrict} onChange={(e) => setForm({...form, permDistrict: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">State *</label>
                        <input value={form.permState} onChange={(e) => setForm({...form, permState: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Pincode *</label>
                        <input value={form.permPincode} onChange={(e) => setForm({...form, permPincode: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 space-y-4">
                    <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase flex items-center gap-2"><Smartphone size={14} className="text-orange-500" /> Current Address</h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Current Staying Address</label>
                        <textarea rows={2} value={form.currentAddress} onChange={(e) => setForm({...form, currentAddress: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none resize-none focus:border-orange-500 transition-colors" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">City</label>
                          <input value={form.currentCity} onChange={(e) => setForm({...form, currentCity: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">State</label>
                          <input value={form.currentState} onChange={(e) => setForm({...form, currentState: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Pincode</label>
                          <input value={form.currentPincode} onChange={(e) => setForm({...form, currentPincode: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Identity Details */}
              {formStep === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase flex items-center gap-2"><ShieldCheck size={14} className="text-orange-500" /> Identity Info</h3>
                       <div className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Aadhaar Number *</label>
                            <input placeholder="12 digit number" value={form.aadhaarNumber} onChange={(e) => setForm({...form, aadhaarNumber: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl font-semibold text-sm outline-none focus:border-orange-500 transition-colors" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">PAN Number *</label>
                            <input placeholder="ABCDE1234F" value={form.panNumber} onChange={(e) => setForm({...form, panNumber: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl font-semibold text-sm outline-none focus:border-orange-500 transition-colors" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Verification Status</label>
                            <select value={form.verificationStatus} onChange={(e) => setForm({...form, verificationStatus: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-bold outline-none text-orange-600 appearance-none focus:border-orange-500 transition-colors">
                               <option value="PENDING">PENDING</option>
                               <option value="VERIFIED">VERIFIED</option>
                               <option value="REJECTED">REJECTED</option>
                            </select>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase flex items-center gap-2"><FileText size={14} className="text-orange-500" /> Documents</h3>
                       <div className="space-y-2">
                          {[
                            { key: 'hasAadhaar', label: 'Aadhaar Card' },
                            { key: 'hasPan', label: 'PAN Card' },
                            { key: 'hasVoterId', label: 'Voter ID' },
                            { key: 'hasDrivingLicense', label: 'Driving License' },
                            { key: 'hasPassport', label: 'Passport (opt.)' }
                          ].map(doc => (
                            <label key={doc.key} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                               <span className="text-[11px] font-bold text-slate-700">{doc.label}</span>
                               <input 
                                 type="checkbox" 
                                 checked={(form as any)[doc.key]} 
                                 onChange={(e) => setForm({...form, [doc.key]: e.target.checked})} 
                                 className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" 
                               />
                            </label>
                          ))}
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Bank & Salary */}
              {formStep === 4 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase flex items-center gap-2"><Landmark size={14} className="text-orange-500" /> Bank Details</h3>
                        <div className="grid grid-cols-1 gap-4">
                           <div className="space-y-1">
                             <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Account Holder Name</label>
                             <input value={form.bankAccountHolder} onChange={(e) => setForm({...form, bankAccountHolder: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1">
                               <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Bank Name</label>
                               <input value={form.bankName} onChange={(e) => setForm({...form, bankName: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                             </div>
                             <div className="space-y-1">
                               <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Branch Name</label>
                               <input value={form.bankBranch} onChange={(e) => setForm({...form, bankBranch: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                             </div>
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Account Number *</label>
                             <input value={form.bankAccountNumber} onChange={(e) => setForm({...form, bankAccountNumber: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1">
                               <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">IFSC Code *</label>
                               <input value={form.ifscCode} onChange={(e) => setForm({...form, ifscCode: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                             </div>
                             <div className="space-y-1">
                               <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">UPI ID (opt.)</label>
                               <input value={form.upiId} onChange={(e) => setForm({...form, upiId: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                             </div>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase flex items-center gap-2"><IndianRupee size={14} className="text-orange-500" /> Salary Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1 col-span-2">
                             <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">Salary Type</label>
                             <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                                {['Monthly', 'Daily Wage'].map(type => (
                                  <button 
                                    key={type}
                                    type="button"
                                    onClick={() => setForm({...form, salaryType: type})}
                                    className={clsx("flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", form.salaryType === type ? "bg-white dark:bg-slate-800 text-orange-600 shadow-sm" : "text-slate-400 dark:text-slate-500")}
                                  >
                                    {type}
                                  </button>
                                ))}
                             </div>
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Basic Salary *</label>
                             <input type="number" value={form.salary} onChange={(e) => setForm({...form, salary: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-orange-500 transition-colors" />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Allowances</label>
                             <input type="number" value={form.allowances} onChange={(e) => setForm({...form, allowances: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-bold outline-none" />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Incentives</label>
                             <input type="number" value={form.incentives} onChange={(e) => setForm({...form, incentives: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-bold outline-none" />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Credit Date</label>
                             <input type="number" placeholder="1-31" value={form.salaryCreditDate} onChange={(e) => setForm({...form, salaryCreditDate: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-bold outline-none" />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">PF Deduction</label>
                             <input placeholder="Ex: 1800" value={form.pfDeduction} onChange={(e) => setForm({...form, pfDeduction: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-bold outline-none" />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">ESI Deduction</label>
                             <input placeholder="Ex: 300" value={form.esiDeduction} onChange={(e) => setForm({...form, esiDeduction: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-bold outline-none" />
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {/* Step 5: Department & Work */}
              {formStep === 5 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                         <div className="space-y-4">
                            <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase flex items-center gap-2"><Building2 size={14} className="text-orange-500" /> Dept. Details</h3>
                            <div className="grid grid-cols-1 gap-4">
                               <div className="space-y-1">
                                 <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Department Name *</label>
                                 <input value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                               </div>
                               <div className="space-y-1">
                                 <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Designation *</label>
                                 <input value={form.designation} onChange={(e) => setForm({...form, designation: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                               </div>
                               <div className="space-y-1">
                                 <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Reporting Manager</label>
                                 <input value={form.reportingManager} onChange={(e) => setForm({...form, reportingManager: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                               </div>
                               <div className="space-y-1">
                                 <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase ml-1">Date of Joining *</label>
                                 <input type="date" value={form.dateOfJoining} onChange={(e) => setForm({...form, dateOfJoining: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-[#1a1c26] border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 transition-colors" />
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-6">
                         <div className="space-y-4">
                            <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase flex items-center gap-2"><Users size={14} className="text-orange-500" /> Status</h3>
                            <div className="grid grid-cols-2 gap-2">
                               {['Permanent', 'Contract', 'Intern', 'Temporary'].map(type => (
                                 <button 
                                   key={type}
                                   type="button"
                                   onClick={() => setForm({...form, employeeType: type})}
                                   className={clsx(
                                     "py-3 rounded-xl text-[9px] font-black uppercase transition-all border",
                                     form.employeeType === type 
                                       ? "bg-orange-50 border-orange-200 text-orange-600" 
                                       : "bg-white border-slate-100 text-slate-400"
                                   )}
                                 >
                                   {type}
                                 </button>
                               ))}
                            </div>
                         </div>

                         <div className="space-y-4 pt-4 border-t border-slate-100">
                            <h3 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase flex items-center gap-2"><Lock size={14} className="text-orange-500" /> Access</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                               {[
                                 { key: 'hasErpAccess', label: 'ERP Access' },
                                 { key: 'hasAttendanceAccess', label: 'Attendance' },
                                 { key: 'hasPayrollAccess', label: 'Payroll' },
                                 { key: 'hasLeaveAccess', label: 'Leave' }
                               ].map(access => (
                                 <label key={access.key} className="flex items-center justify-between p-3 bg-white dark:bg-[#1a1c26] border border-slate-200 dark:border-white/5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{access.label}</span>
                                    <input 
                                      type="checkbox" 
                                      checked={(form as any)[access.key]} 
                                      onChange={(e) => setForm({...form, [access.key]: e.target.checked})} 
                                      className="w-4 h-4 rounded text-orange-600" 
                                    />
                                 </label>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col gap-3 pt-6 sm:pt-8 mt-6 sm:mt-8 border-t border-slate-100">
               {stepError && (
                 <div className="animate-in fade-in slide-in-from-top-1 duration-200 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-4 py-2 rounded-xl flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{stepError}</p>
                 </div>
               )}
               <div className="flex gap-3 sm:gap-4">
                 <button 
                   type="button" 
                   onClick={formStep === 1 ? () => setShowForm(false) : prevStep} 
                   className="flex-1 py-3.5 sm:py-4 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 rounded-2xl transition-all flex items-center justify-center gap-2"
                 >
                   {formStep === 1 ? "Cancel" : <><ChevronLeft size={16} /> Back</>}
                 </button>
                 <button 
                   type="button" 
                   onClick={formStep === 5 ? handleSubmit : nextStep} 
                   disabled={saving}
                   className="flex-[2] py-3.5 sm:py-4 bg-orange-600 text-white rounded-2xl text-[10px] sm:text-[11px] font-black shadow-lg shadow-orange-500/20 uppercase tracking-widest hover:bg-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   {saving ? "Processing..." : (
                     formStep === 5 ? (
                       <>Confirm <CheckCircle2 size={16} /></>
                     ) : (
                       <>Next <ChevronRight size={16} /></>
                     )
                   )}
                 </button>
               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

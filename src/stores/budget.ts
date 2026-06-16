import { create } from 'zustand';
import { BudgetConfig, BudgetSummary, NuRecommendation } from '../types';

const DEFAULT_NET_SALARY = 2825095;
const EMERGENCY_FUND_TARGET = 8475285; // 3 months

interface BudgetState {
  config: BudgetConfig | null;
  summary: BudgetSummary | null;
  nuRecommendation: NuRecommendation | null;
  setConfig: (config: BudgetConfig) => void;
  setSummary: (summary: BudgetSummary) => void;
  computeNuRecommendation: (cycleSpend: number, savedSoFar: number) => NuRecommendation;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  config: null,
  summary: null,
  nuRecommendation: null,

  setConfig: (config) => set({ config }),
  setSummary: (summary) => set({ summary }),

  computeNuRecommendation: (cycleSpend: number, savedSoFar: number): NuRecommendation => {
    const config = get().config;
    const income = config?.income ?? DEFAULT_NET_SALARY;
    const wantsPct = (config?.wants_pct ?? 30) / 100;
    const savingsPct = (config?.savings_pct ?? 12) / 100;

    const wantsLimit = income * wantsPct;
    const savingsTarget = income * savingsPct;
    const emergencyBuffer = income * 0.05; // 5% buffer

    const available = wantsLimit - cycleSpend + emergencyBuffer;
    const canPayFull = available >= cycleSpend;
    const paymentAmount = canPayFull ? cycleSpend : Math.max(0, available);

    let status: 'green' | 'yellow' | 'red';
    let message: string;

    if (canPayFull) {
      status = 'green';
      message = `Puedes pagar el total de ${formatCOP(cycleSpend)} sin afectar tu presupuesto.`;
    } else if (paymentAmount >= cycleSpend * 0.7) {
      status = 'yellow';
      message = `Paga ${formatCOP(paymentAmount)}. El saldo restante generará intereses.`;
    } else {
      status = 'red';
      message = `Solo tienes ${formatCOP(paymentAmount)} disponible. Revisa tus gastos del mes.`;
    }

    const emergencyFundProgress = (savedSoFar / EMERGENCY_FUND_TARGET) * 100;

    const rec: NuRecommendation = {
      cycleSpend,
      availableForPayment: available,
      canPayFull,
      paymentAmount,
      savingsTransfer: savingsTarget,
      emergencyFundProgress: Math.min(emergencyFundProgress, 100),
      emergencyFundTarget: EMERGENCY_FUND_TARGET,
      status,
      message,
    };

    set({ nuRecommendation: rec });
    return rec;
  },
}));

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

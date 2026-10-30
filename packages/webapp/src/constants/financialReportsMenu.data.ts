import { AbilitySubject, AuditLogAction, ReportsAction } from './abilityOption';
import { Features } from './features';

export type FinancialReportText = { messageId: string } | { text: string };

export interface FinancialReportMenuItem {
  title: FinancialReportText;
  desc: FinancialReportText;
  link: string;
  subject: string;
  ability: string;
  feature?: string;
}

export interface FinancialReportMenuSection {
  sectionTitle: FinancialReportText;
  reports: FinancialReportMenuItem[];
}

export const financialReportMenuData: FinancialReportMenuSection[] = [
  {
    sectionTitle: { messageId: 'financial_accounting' },
    reports: [
      {
        title: { messageId: 'balance_sheet_report' },
        desc: {
          messageId: 'reports_a_company_s_assets_liabilities_and_shareholders',
        },
        link: '/financial-reports/balance-sheet',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_BALANCE_SHEET,
      },
      {
        title: { messageId: 'trial_balance_sheet' },
        desc: {
          messageId: 'summarizes_the_credit_and_debit_balance_of_each_account',
        },
        link: '/financial-reports/trial-balance-sheet',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_TRIAL_BALANCE_SHEET,
      },
      {
        title: { messageId: 'profit_loss_report' },
        desc: { messageId: 'reports_the_revenues_costs_and_expenses' },
        link: '/financial-reports/profit-loss-sheet',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_PROFIT_LOSS,
      },
      {
        title: { messageId: 'cash_flow_statement' },
        desc: {
          messageId: 'reports_inflow_and_outflow_of_cash_and_cash_equivalents',
        },
        link: '/financial-reports/cash-flow',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_CASHFLOW,
      },
      {
        title: { messageId: 'journal_report' },
        desc: {
          messageId: 'the_debit_and_credit_entries_of_system_transactions',
        },
        link: '/financial-reports/journal-sheet',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_JOURNAL,
      },
      {
        title: { messageId: 'general_ledger_report' },
        desc: {
          messageId: 'reports_every_transaction_going_in_and_out_of_your',
        },
        link: '/financial-reports/general-ledger',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_GENERAL_LEDGET,
      },
      {
        title: { messageId: 'receivable_aging_summary' },
        desc: {
          messageId: 'summarize_total_unpaid_balances_of_customers_invoices',
        },
        link: '/financial-reports/receivable-aging-summary',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_AR_AGING_SUMMARY,
      },
      {
        title: { messageId: 'payable_aging_summary' },
        desc: {
          messageId: 'summarize_total_unpaid_balances_of_vendors_purchase',
        },
        link: '/financial-reports/payable-aging-summary',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_AP_AGING_SUMMARY,
      },
      {
        title: { messageId: 'report.balance_sheet_comparison.title' },
        desc: { messageId: 'report.balance_sheet_comparison.desc' },
        link: 'financial-reports/balance-sheet?previousYear=true&previousYearAmountChange=true&previousYearPercentageChange=true',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_BALANCE_SHEET,
      },
      {
        title: { messageId: 'report.profit_loss_sheet_comparison.title' },
        desc: { messageId: 'report.profit_loss_sheet_comparison.desc' },
        link: '/financial-reports/profit-loss-sheet?previousYear=true&previousYearAmountChange=true&previousYearPercentageChange=true',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_PROFIT_LOSS,
      },
    ],
  },
  {
    sectionTitle: { messageId: 'sales_purchases_reports' },
    reports: [
      {
        title: { messageId: 'purchases_by_items' },
        desc: {
          messageId:
            'summarize_the_business_s_purchase_items_quantity_cost_and_average',
        },
        link: '/financial-reports/purchases-by-items',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_PURCHASES_BY_ITEMS,
      },
      {
        title: { messageId: 'sales_by_items' },
        desc: {
          messageId:
            'summarize_the_business_s_sold_items_quantity_income_and_average_income_rate',
        },
        link: '/financial-reports/sales-by-items',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_SALES_BY_ITEMS,
      },
      {
        title: { messageId: 'customers_balance_summary' },
        desc: {
          messageId:
            'summerize_the_total_amount_of_each_customer_owes_your_business',
        },
        link: '/financial-reports/customers-balance-summary',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_CUSTOMERS_SUMMARY_BALANCE,
      },
      {
        title: { messageId: 'vendors_balance_summary' },
        desc: {
          messageId:
            'summerize_the_total_amount_your_business_owes_each_vendor',
        },
        link: '/financial-reports/vendors-balance-summary',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_VENDORS_SUMMARY_BALANCE,
      },
      {
        title: { messageId: 'customers_transactions' },
        desc: {
          messageId:
            'reports_every_transaction_going_in_and_out_of_each_customer',
        },
        link: '/financial-reports/transactions-by-customers',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_CUSTOMERS_TRANSACTIONS,
      },
      {
        title: { messageId: 'vendors_transactions' },
        desc: {
          messageId:
            'reports_every_transaction_going_in_and_out_of_each_vendor_supplier',
        },
        link: '/financial-reports/transactions-by-vendors',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_VENDORS_TRANSACTIONS,
      },
      {
        title: { messageId: 'inventory_item_details' },
        desc: {
          messageId: 'reports_every_transaction_going_in_and_out_of_your_items',
        },
        link: '/financial-reports/inventory-item-details',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_INVENTORY_ITEM_DETAILS,
      },
      {
        title: { messageId: 'inventory_valuation' },
        desc: {
          messageId: 'summerize_your_transactions_for_each_inventory_item',
        },
        link: '/financial-reports/inventory-valuation',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_INVENTORY_VALUATION_SUMMARY,
      },
    ],
  },
  {
    sectionTitle: { text: 'Taxes' },
    reports: [
      {
        title: { text: 'Sales Tax Liability Summary' },
        desc: {
          text: 'Reports the total amount of sales tax collected from customers',
        },
        link: '/financial-reports/sales-tax-liability-summary',
        subject: AbilitySubject.Report,
        ability: ReportsAction.READ_SALES_TAX_LIABILITY_SUMMARY,
        feature: Features.SalesTax,
      },
    ],
  },
  {
    sectionTitle: { messageId: 'system_reports' },
    reports: [
      {
        title: { messageId: 'audit_log_report' },
        desc: { messageId: 'audit_log_report_desc' },
        link: '/financial-reports/audit-log',
        subject: AbilitySubject.AuditLog,
        ability: AuditLogAction.View,
      },
    ],
  },
];

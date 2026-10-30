export const OtherExpensesAccount = {
  name: 'Other Expenses',
  slug: 'other-expenses',
  accountType: 'other-expense',
  code: '40011',
  description: '',
  active: true,
  index: 1,
  predefined: true,
};

export const TaxPayableAccount = {
  name: 'Tax Payable',
  slug: 'tax-payable',
  accountType: 'tax-payable',
  code: '20006',
  description: '',
  active: true,
  index: 1,
  predefined: true,
};

export const UnearnedRevenueAccount = {
  name: 'Unearned Revenue',
  slug: 'unearned-revenue',
  accountType: 'other-current-liability',
  parentAccountId: null,
  code: '50005',
  active: true,
  index: 1,
  predefined: true,
};

export const PrepardExpenses = {
  name: 'Prepaid Expenses',
  slug: 'prepaid-expenses',
  accountType: 'other-current-asset',
  parentAccountId: null,
  code: '100010',
  active: true,
  index: 1,
  predefined: true,
};

export const StripeClearingAccount = {
  name: 'Stripe Clearing',
  slug: 'stripe-clearing',
  accountType: 'other-current-asset',
  parentAccountId: null,
  code: '100020',
  active: true,
  index: 1,
  predefined: true,
};

export const DiscountExpenseAccount = {
  name: 'Discount',
  slug: 'discount',
  accountType: 'other-income',
  code: '40008',
  active: true,
  index: 1,
  predefined: true,
};

export const PurchaseDiscountAccount = {
  name: 'Purchase Discount',
  slug: 'purchase-discount',
  accountType: 'other-expense',
  code: '40009',
  active: true,
  index: 1,
  predefined: true,
};

export const OtherChargesAccount = {
  name: 'Other Charges',
  slug: 'other-charges',
  accountType: 'other-income',
  code: '40010',
  active: true,
  index: 1,
  predefined: true,
};

export const ACCOUNT_TYPE = {
  CASH: 'cash',
  BANK: 'bank',
  ACCOUNTS_RECEIVABLE: 'accounts-receivable',
  INVENTORY: 'inventory',
  OTHER_CURRENT_ASSET: 'other-current-asset',
  FIXED_ASSET: 'fixed-asset',
  NON_CURRENT_ASSET: 'non-current-asset',

  ACCOUNTS_PAYABLE: 'accounts-payable',
  CREDIT_CARD: 'credit-card',
  TAX_PAYABLE: 'tax-payable',
  OTHER_CURRENT_LIABILITY: 'other-current-liability',
  LOGN_TERM_LIABILITY: 'long-term-liability',
  NON_CURRENT_LIABILITY: 'non-current-liability',

  EQUITY: 'equity',
  INCOME: 'income',
  OTHER_INCOME: 'other-income',
  COST_OF_GOODS_SOLD: 'cost-of-goods-sold',
  EXPENSE: 'expense',
  OTHER_EXPENSE: 'other-expense',
};

export const ACCOUNT_PARENT_TYPE = {
  CURRENT_ASSET: 'current-asset',
  FIXED_ASSET: 'fixed-asset',
  NON_CURRENT_ASSET: 'non-current-asset',

  CURRENT_LIABILITY: 'current-liability',
  LOGN_TERM_LIABILITY: 'long-term-liability',
  NON_CURRENT_LIABILITY: 'non-current-liability',

  EQUITY: 'equity',
  EXPENSE: 'expense',
  INCOME: 'income',
};

export const ACCOUNT_ROOT_TYPE = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  EXPENSE: 'expense',
  INCOME: 'income',
};

export const ACCOUNT_NORMAL = {
  CREDIT: 'credit',
  DEBIT: 'debit',
};
export const ACCOUNT_TYPES = [
  {
    label: 'Cash',
    key: ACCOUNT_TYPE.CASH,
    normal: ACCOUNT_NORMAL.DEBIT,
    parentType: ACCOUNT_PARENT_TYPE.CURRENT_ASSET,
    rootType: ACCOUNT_ROOT_TYPE.ASSET,
    multiCurrency: true,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Bank',
    key: ACCOUNT_TYPE.BANK,
    normal: ACCOUNT_NORMAL.DEBIT,
    parentType: ACCOUNT_PARENT_TYPE.CURRENT_ASSET,
    rootType: ACCOUNT_ROOT_TYPE.ASSET,
    multiCurrency: true,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Accounts Receivable',
    key: ACCOUNT_TYPE.ACCOUNTS_RECEIVABLE,
    normal: ACCOUNT_NORMAL.DEBIT,
    rootType: ACCOUNT_ROOT_TYPE.ASSET,
    parentType: ACCOUNT_PARENT_TYPE.CURRENT_ASSET,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Inventory',
    key: ACCOUNT_TYPE.INVENTORY,
    normal: ACCOUNT_NORMAL.DEBIT,
    rootType: ACCOUNT_ROOT_TYPE.ASSET,
    parentType: ACCOUNT_PARENT_TYPE.CURRENT_ASSET,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Other Current Asset',
    key: ACCOUNT_TYPE.OTHER_CURRENT_ASSET,
    normal: ACCOUNT_NORMAL.DEBIT,
    rootType: ACCOUNT_ROOT_TYPE.ASSET,
    parentType: ACCOUNT_PARENT_TYPE.CURRENT_ASSET,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Fixed Asset',
    key: ACCOUNT_TYPE.FIXED_ASSET,
    normal: ACCOUNT_NORMAL.DEBIT,
    rootType: ACCOUNT_ROOT_TYPE.ASSET,
    parentType: ACCOUNT_PARENT_TYPE.FIXED_ASSET,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Non-Current Asset',
    key: ACCOUNT_TYPE.NON_CURRENT_ASSET,
    normal: ACCOUNT_NORMAL.DEBIT,
    rootType: ACCOUNT_ROOT_TYPE.ASSET,
    parentType: ACCOUNT_PARENT_TYPE.FIXED_ASSET,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Accounts Payable',
    key: ACCOUNT_TYPE.ACCOUNTS_PAYABLE,
    normal: ACCOUNT_NORMAL.CREDIT,
    rootType: ACCOUNT_ROOT_TYPE.LIABILITY,
    parentType: ACCOUNT_PARENT_TYPE.CURRENT_LIABILITY,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Credit Card',
    key: ACCOUNT_TYPE.CREDIT_CARD,
    normal: ACCOUNT_NORMAL.CREDIT,
    rootType: ACCOUNT_ROOT_TYPE.LIABILITY,
    parentType: ACCOUNT_PARENT_TYPE.CURRENT_LIABILITY,
    multiCurrency: true,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Tax Payable',
    key: ACCOUNT_TYPE.TAX_PAYABLE,
    normal: ACCOUNT_NORMAL.CREDIT,
    rootType: ACCOUNT_ROOT_TYPE.LIABILITY,
    parentType: ACCOUNT_PARENT_TYPE.CURRENT_LIABILITY,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Other Current Liability',
    key: ACCOUNT_TYPE.OTHER_CURRENT_LIABILITY,
    normal: ACCOUNT_NORMAL.CREDIT,
    rootType: ACCOUNT_ROOT_TYPE.LIABILITY,
    parentType: ACCOUNT_PARENT_TYPE.CURRENT_LIABILITY,
    balanceSheet: false,
    incomeSheet: true,
  },
  {
    label: 'Long Term Liability',
    key: ACCOUNT_TYPE.LOGN_TERM_LIABILITY,
    normal: ACCOUNT_NORMAL.CREDIT,
    rootType: ACCOUNT_ROOT_TYPE.LIABILITY,
    parentType: ACCOUNT_PARENT_TYPE.LOGN_TERM_LIABILITY,
    balanceSheet: false,
    incomeSheet: true,
  },
  {
    label: 'Non-Current Liability',
    key: ACCOUNT_TYPE.NON_CURRENT_LIABILITY,
    normal: ACCOUNT_NORMAL.CREDIT,
    rootType: ACCOUNT_ROOT_TYPE.LIABILITY,
    parentType: ACCOUNT_PARENT_TYPE.NON_CURRENT_LIABILITY,
    balanceSheet: false,
    incomeSheet: true,
  },
  {
    label: 'Equity',
    key: ACCOUNT_TYPE.EQUITY,
    normal: ACCOUNT_NORMAL.CREDIT,
    rootType: ACCOUNT_ROOT_TYPE.EQUITY,
    parentType: ACCOUNT_PARENT_TYPE.EQUITY,
    balanceSheet: true,
    incomeSheet: false,
  },
  {
    label: 'Income',
    key: ACCOUNT_TYPE.INCOME,
    normal: ACCOUNT_NORMAL.CREDIT,
    rootType: ACCOUNT_ROOT_TYPE.INCOME,
    parentType: ACCOUNT_PARENT_TYPE.INCOME,
    balanceSheet: false,
    incomeSheet: true,
  },
  {
    label: 'Other Income',
    key: ACCOUNT_TYPE.OTHER_INCOME,
    normal: ACCOUNT_NORMAL.CREDIT,
    rootType: ACCOUNT_ROOT_TYPE.INCOME,
    parentType: ACCOUNT_PARENT_TYPE.INCOME,
    balanceSheet: false,
    incomeSheet: true,
  },
  {
    label: 'Cost of Goods Sold',
    key: ACCOUNT_TYPE.COST_OF_GOODS_SOLD,
    normal: ACCOUNT_NORMAL.DEBIT,
    rootType: ACCOUNT_ROOT_TYPE.EXPENSE,
    parentType: ACCOUNT_PARENT_TYPE.EXPENSE,
    balanceSheet: false,
    incomeSheet: true,
  },
  {
    label: 'Expense',
    key: ACCOUNT_TYPE.EXPENSE,
    normal: ACCOUNT_NORMAL.DEBIT,
    rootType: ACCOUNT_ROOT_TYPE.EXPENSE,
    parentType: ACCOUNT_PARENT_TYPE.EXPENSE,
    balanceSheet: false,
    incomeSheet: true,
  },
  {
    label: 'Other Expense',
    key: ACCOUNT_TYPE.OTHER_EXPENSE,
    normal: ACCOUNT_NORMAL.DEBIT,
    rootType: ACCOUNT_ROOT_TYPE.EXPENSE,
    parentType: ACCOUNT_PARENT_TYPE.EXPENSE,
    balanceSheet: false,
    incomeSheet: true,
  },
];

export const getAccountsSupportsMultiCurrency = () => {
  return ACCOUNT_TYPES.filter((account) => account.multiCurrency);
};

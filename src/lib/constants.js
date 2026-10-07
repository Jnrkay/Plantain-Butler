export const COLORS_CHART = [
  '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444',
  '#10b981', '#ec4899', '#3b82f6', '#f97316'
]

export const CATEGORIES = [
  'Proteins', 'Grains', 'Beverages', 'Cleaning', 'Toiletries',
  'Produce', 'Dairy', 'Snacks', 'Cooking Essentials', 'Other'
]

export const STOCK_STATUS = {
  high: { label: 'In Stock', color: '#10b981' },
  medium: { label: 'Running Low', color: '#f59e0b' },
  low: { label: 'Out of Stock', color: '#ef4444' },
}

export const HOUSEHOLD_TYPES = [
  'Single person', 'Married couple', 'Family with kids',
  'Roommates', 'Extended family'
]

export const DEFAULT_PROFILE = {
  householdType: '', adults: 1, kids: 0,
  shopFrequency: '', shopFreqCustom: '',
  monthlyBudget: 0, stores: [], dietaryPrefs: '',
  topCategories: [], onboarded: false,
}

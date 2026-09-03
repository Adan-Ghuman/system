export function formatCurrency(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `Rs. ${formatted}`;
}

export function formatWeight(kg: number): string {
  const formatted = kg.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${formatted} Kg`;
}

export function formatBalance(amount: number): {
  text: string;
  type: 'Dr' | 'Cr' | 'Nil';
  formatted: string;
} {
  if (Math.abs(amount) < 0.01) {
    return {
      text: 'Rs. 0.00 Nil',
      type: 'Nil',
      formatted: 'Rs. 0.00'
    };
  }

  if (amount > 0) {
    return {
      text: `${formatCurrency(amount)} Dr`,
      type: 'Dr',
      formatted: formatCurrency(amount)
    };
  }

  return {
    text: `${formatCurrency(Math.abs(amount))} Cr`,
    type: 'Cr',
    formatted: formatCurrency(Math.abs(amount))
  };
}

export function formatDate(dateString: string | Date): string {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

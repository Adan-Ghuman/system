const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen'
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety'
];

function convertBelowThousand(num: number): string {
  let result = '';

  if (num >= 100) {
    result += ONES[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }

  if (num >= 20) {
    result += TENS[Math.floor(num / 10)] + ' ';
    num %= 10;
  }

  if (num > 0) {
    result += ONES[num] + ' ';
  }

  return result.trim();
}

export function numberToWords(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only';

  let num = Math.floor(Math.abs(amount));
  let words = '';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  if (crore > 0) {
    words += convertBelowThousand(crore) + ' Crore ';
  }

  const lakh = Math.floor(num / 100000);
  num %= 100000;
  if (lakh > 0) {
    words += convertBelowThousand(lakh) + ' Lakh ';
  }

  const thousand = Math.floor(num / 1000);
  num %= 1000;
  if (thousand > 0) {
    words += convertBelowThousand(thousand) + ' Thousand ';
  }

  if (num > 0) {
    words += convertBelowThousand(num) + ' ';
  }

  return `${words.trim()} Rupees Only`;
}

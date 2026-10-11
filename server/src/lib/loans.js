/** Loan helpers. `status` is computed, never trusted from storage. */
export function repaidTotal(loan) {
  return (loan.repayments ?? []).reduce((s, r) => s + r.amount, 0);
}

export function outstanding(loan) {
  return Math.max(loan.amount - repaidTotal(loan), 0);
}

export function loanStatus(loan, today) {
  const out = outstanding(loan);
  if (out === 0) return 'returned';
  if (loan.expectedReturnDate && loan.expectedReturnDate < today) return 'overdue';
  return repaidTotal(loan) > 0 ? 'partial' : 'pending';
}

export function decorateLoan(loan, today) {
  const obj = typeof loan.toJSON === 'function' ? loan.toJSON() : loan;
  return {
    ...obj,
    repaid: repaidTotal(obj),
    outstanding: outstanding(obj),
    status: loanStatus(obj, today),
  };
}

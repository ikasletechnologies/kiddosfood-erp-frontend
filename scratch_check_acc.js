const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const account = await prisma.account.findUnique({
    where: { accountCode: 'ACC-002' },
    include: {
      payments: true,
      expenses: true
    }
  });
  console.log('Account:', { ...account, payments: account.payments.length, expenses: account.expenses.length });
  
  let inflows = 0;
  let outflows = 0;
  
  for (const p of account.payments) {
    if (p.entityType === 'CUSTOMER') inflows += p.paidAmount;
    if (p.entityType === 'VENDOR') outflows += p.paidAmount;
  }
  
  for (const e of account.expenses) {
    outflows += e.amount;
  }
  
  console.log(`Computed Inflows: ${inflows}, Outflows: ${outflows}, Net: ${inflows - outflows}`);
  
  if (account.balance > 1000000000) {
    console.log('Updating to computed balance');
    await prisma.account.update({
      where: { id: account.id },
      data: { balance: inflows - outflows }
    });
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

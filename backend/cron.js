const cron = require('node-cron');
const {
  processUpcomingBookingReminders,
  processPendingFormReminders,
  processLowStockAlerts,
  autoCompletePastBookings
} = require('./services/automation');

// Every 15 minutes: check for upcoming booking reminders
cron.schedule('*/15 * * * *', async () => {
  console.log('[CRON] Running booking reminders...');
  await processUpcomingBookingReminders();
});

// Every hour: check for pending form reminders
cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Running form reminders...');
  await processPendingFormReminders();
});

// Every 30 minutes: check inventory low stock
cron.schedule('*/30 * * * *', async () => {
  console.log('[CRON] Running low stock check...');
  await processLowStockAlerts();
});

// Daily at midnight: auto-complete past bookings
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Auto-completing past bookings...');
  await autoCompletePastBookings();
});

console.log('Cron jobs initialized (reminders, forms, inventory, auto-complete)');

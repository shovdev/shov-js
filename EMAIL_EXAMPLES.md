# Email API Examples - shov-js v2.1.0

## New in v2.1.0: Email Operations

The Shov JS SDK now includes full email support with three methods:
- `shov.email.send()` - Send individual emails
- `shov.email.sendTemplate()` - Send emails using templates
- `shov.email.sendBatch()` - Send multiple emails in one request

---

## Installation

```bash
npm install shov-js@latest
```

---

## Basic Email Sending

### Simple Email

```typescript
import { Shov } from 'shov-js';

const shov = new Shov({
  projectName: 'my-project',
  apiKey: process.env.SHOV_API_KEY
});

// Send a simple email
const result = await shov.email.send({
  to: 'user@example.com',
  subject: 'Welcome to Our App!',
  body: 'Thanks for signing up. We&apos;re excited to have you!'
});

console.log('Email sent:', result.messageId);
```

### Email with HTML

```typescript
await shov.email.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Plain text fallback',
  html: `
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h1>Welcome to Our App!</h1>
        <p>Thanks for signing up. We&apos;re excited to have you!</p>
        <a href="https://yourapp.com/get-started" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Get Started
        </a>
      </body>
    </html>
  `
});
```

### Multiple Recipients

```typescript
await shov.email.send({
  to: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
  subject: 'Team Update',
  body: 'Here&apos;s the latest news from the team...'
});
```

### With CC/BCC

```typescript
await shov.email.send({
  to: 'customer@example.com',
  cc: ['manager@company.com', 'sales@company.com'],
  bcc: 'archive@company.com',
  subject: 'Your Order Confirmation',
  body: 'Thank you for your order!',
  from: 'orders@company.com',
  replyTo: 'support@company.com'
});
```

---

## Template-Based Emails

### Send with Template

```typescript
// Send using a pre-defined template
await shov.email.sendTemplate({
  to: 'user@example.com',
  templateId: 'welcome-email',
  variables: {
    name: 'Alice',
    activationUrl: 'https://yourapp.com/activate/abc123',
    expiresIn: '24 hours'
  }
});
```

### Common Template Examples

#### Password Reset

```typescript
await shov.email.sendTemplate({
  to: user.email,
  templateId: 'password-reset',
  variables: {
    name: user.name,
    resetUrl: `https://yourapp.com/reset/${resetToken}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString()
  }
});
```

#### Order Confirmation

```typescript
await shov.email.sendTemplate({
  to: order.customerEmail,
  templateId: 'order-confirmation',
  variables: {
    orderNumber: order.id,
    items: order.items,
    total: order.total,
    estimatedDelivery: order.deliveryDate
  },
  from: 'orders@company.com',
  replyTo: 'support@company.com'
});
```

#### Weekly Digest

```typescript
await shov.email.sendTemplate({
  to: user.email,
  templateId: 'weekly-digest',
  variables: {
    name: user.name,
    newPosts: recentPosts.length,
    topPost: recentPosts[0],
    unreadCount: user.unreadMessages
  }
});
```

---

## Batch Email Sending

### Send Multiple Emails at Once

```typescript
const newUsers = [
  { email: 'alice@example.com', name: 'Alice' },
  { email: 'bob@example.com', name: 'Bob' },
  { email: 'charlie@example.com', name: 'Charlie' }
];

const result = await shov.email.sendBatch(
  newUsers.map(user => ({
    to: user.email,
    subject: `Welcome, ${user.name}!`,
    body: `Hi ${user.name}, thanks for joining our platform!`,
    html: `
      <h1>Welcome, ${user.name}!</h1>
      <p>Thanks for joining our platform!</p>
    `
  }))
);

console.log(`Sent: ${result.sent}, Failed: ${result.failed}`);

// Check individual results
result.results.forEach(r => {
  if (r.error) {
    console.error(`Failed to send to ${r.to}:`, r.error);
  } else {
    console.log(`Sent to ${r.to}, messageId: ${r.messageId}`);
  }
});
```

### Batch with Error Handling

```typescript
const notifications = await shov.where('notifications', {
  filter: { sent: false, scheduledFor: { $lte: new Date().toISOString() } }
});

const result = await shov.email.sendBatch(
  notifications.items.map(notif => ({
    to: notif.value.recipientEmail,
    subject: notif.value.subject,
    body: notif.value.message,
    from: 'notifications@company.com'
  }))
);

// Mark successful sends
for (const res of result.results) {
  if (!res.error) {
    const notif = notifications.items.find(n => n.value.recipientEmail === res.to);
    await shov.update('notifications', notif.id, {
      ...notif.value,
      sent: true,
      sentAt: new Date().toISOString(),
      messageId: res.messageId
    });
  }
}
```

---

## Real-World Use Cases

### User Registration Flow

```typescript
// After user signs up
async function sendWelcomeEmail(user: { email: string; name: string; id: string }) {
  const verificationToken = generateToken();
  
  // Store token
  await shov.set(`verification:${user.id}`, verificationToken, { ttl: 86400 }); // 24 hours
  
  // Send welcome email with verification
  await shov.email.send({
    to: user.email,
    subject: 'Welcome! Please verify your email',
    body: `Hi ${user.name}, click here to verify: https://yourapp.com/verify/${verificationToken}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome, ${user.name}! 👋</h2>
        <p>Thanks for signing up. Please verify your email to get started.</p>
        <a href="https://yourapp.com/verify/${verificationToken}" 
           style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 12px;">This link expires in 24 hours.</p>
      </div>
    `
  });
  
  // Track event
  await shov.events.track('email.welcome.sent', {
    userId: user.id,
    email: user.email
  });
}
```

### Payment Receipt

```typescript
async function sendPaymentReceipt(payment: Payment) {
  await shov.email.send({
    to: payment.customerEmail,
    subject: `Payment Receipt - $${payment.amount}`,
    body: `Your payment of $${payment.amount} was successful.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Payment Receipt</h1>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Amount:</strong> $${payment.amount}</p>
          <p><strong>Date:</strong> ${new Date(payment.createdAt).toLocaleDateString()}</p>
          <p><strong>Transaction ID:</strong> ${payment.id}</p>
          <p><strong>Status:</strong> <span style="color: green;">✓ Successful</span></p>
        </div>
        <p style="color: #666; font-size: 12px;">
          Questions? Contact us at support@company.com
        </p>
      </div>
    `,
    from: 'billing@company.com',
    replyTo: 'support@company.com'
  });
}
```

### Invitation System

```typescript
async function sendTeamInvitation(invitation: {
  email: string;
  teamName: string;
  invitedBy: string;
  role: string;
}) {
  const inviteToken = generateSecureToken();
  
  // Store invitation
  await shov.add('invitations', {
    email: invitation.email,
    token: inviteToken,
    teamName: invitation.teamName,
    invitedBy: invitation.invitedBy,
    role: invitation.role,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() // 7 days
  });
  
  // Send invitation email
  await shov.email.send({
    to: invitation.email,
    subject: `You&apos;ve been invited to join ${invitation.teamName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>${invitation.invitedBy} invited you to join ${invitation.teamName}</h2>
        <p>You&apos;ve been invited as a <strong>${invitation.role}</strong>.</p>
        <a href="https://yourapp.com/accept-invite/${inviteToken}"
           style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 12px;">
          This invitation expires in 7 days.
        </p>
      </div>
    `
  });
}
```

### Scheduled Reminders

```typescript
// Run this periodically (e.g., via cron)
async function sendScheduledReminders() {
  const now = new Date().toISOString();
  
  // Find reminders due now
  const reminders = await shov.where('reminders', {
    filter: {
      scheduledFor: { $lte: now },
      sent: false
    }
  });
  
  if (reminders.items.length === 0) return;
  
  // Send all reminders in batch
  const result = await shov.email.sendBatch(
    reminders.items.map(reminder => ({
      to: reminder.value.userEmail,
      subject: reminder.value.subject,
      body: reminder.value.message,
      from: 'reminders@company.com'
    }))
  );
  
  // Mark sent
  for (const [index, reminder] of reminders.items.entries()) {
    if (!result.results[index].error) {
      await shov.update('reminders', reminder.id, {
        ...reminder.value,
        sent: true,
        sentAt: now
      });
    }
  }
}
```

---

## Error Handling

### Handling Individual Email Failures

```typescript
try {
  const result = await shov.email.send({
    to: 'user@example.com',
    subject: 'Test',
    body: 'Test message'
  });
  console.log('Email sent:', result.messageId);
} catch (error) {
  if (error.status === 400) {
    console.error('Invalid email format');
  } else if (error.status === 429) {
    console.error('Rate limit exceeded, try again later');
  } else {
    console.error('Email failed:', error.message);
  }
}
```

### Handling Batch Failures

```typescript
const result = await shov.email.sendBatch(messages);

console.log(`Successfully sent: ${result.sent}/${messages.length}`);

// Log failures
const failures = result.results.filter(r => r.error);
if (failures.length > 0) {
  console.error('Failed emails:', failures);
  
  // Retry failed emails individually
  for (const failure of failures) {
    console.log(`Retrying ${failure.to}...`);
    // Implement retry logic
  }
}
```

---

## Best Practices

### 1. **Always Provide Plain Text Fallback**

```typescript
await shov.email.send({
  to: 'user@example.com',
  subject: 'Update',
  body: 'Plain text version for email clients that don&apos;t support HTML',
  html: '<html>...<html>' // Rich HTML version
});
```

### 2. **Use Templates for Common Emails**

Create reusable templates instead of inline HTML for better maintainability.

### 3. **Track Email Events**

```typescript
const result = await shov.email.send({ ... });

// Track for analytics
await shov.events.track('email.sent', {
  to: email.to,
  messageId: result.messageId,
  type: 'welcome'
});
```

### 4. **Rate Limiting for Batch Sends**

```typescript
// Send in chunks to avoid rate limits
const BATCH_SIZE = 100;
const users = await getAllUsers();

for (let i = 0; i < users.length; i += BATCH_SIZE) {
  const batch = users.slice(i, i + BATCH_SIZE);
  
  await shov.email.sendBatch(
    batch.map(user => ({
      to: user.email,
      subject: 'Newsletter',
      body: 'Latest updates...'
    }))
  );
  
  // Wait between batches
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

### 5. **Store Message IDs for Tracking**

```typescript
const result = await shov.email.send({ ... });

// Store for future reference
await shov.add('sent_emails', {
  messageId: result.messageId,
  to: email.to,
  subject: email.subject,
  sentAt: new Date().toISOString()
});
```

---

## Configuration

Email operations use your project's email configuration. Configure via CLI:

```bash
# Set email provider credentials
shov secrets set EMAIL_PROVIDER resend
shov secrets set EMAIL_API_KEY your-api-key
shov secrets set EMAIL_FROM_ADDRESS noreply@yourdomain.com
```

---

## API Reference

### `shov.email.send(options)`

Send a single email.

**Parameters:**
- `to`: `string | string[]` - Recipient email(s)
- `subject`: `string` - Email subject
- `body`: `string` - Plain text body
- `from?`: `string` - Sender email (optional, uses default)
- `replyTo?`: `string` - Reply-to email (optional)
- `cc?`: `string | string[]` - CC recipients (optional)
- `bcc?`: `string | string[]` - BCC recipients (optional)
- `html?`: `string` - HTML body (optional)

**Returns:** `Promise<{ success: true; messageId: string }>`

---

### `shov.email.sendTemplate(options)`

Send email using a template.

**Parameters:**
- `to`: `string | string[]` - Recipient email(s)
- `templateId`: `string` - Template identifier
- `variables?`: `Record<string, any>` - Template variables (optional)
- `from?`: `string` - Sender email (optional)
- `replyTo?`: `string` - Reply-to email (optional)

**Returns:** `Promise<{ success: true; messageId: string }>`

---

### `shov.email.sendBatch(messages)`

Send multiple emails in one request.

**Parameters:**
- `messages`: Array of email objects:
  - `to`: `string` - Recipient email
  - `subject`: `string` - Email subject
  - `body`: `string` - Plain text body
  - `from?`: `string` - Sender email (optional)
  - `html?`: `string` - HTML body (optional)

**Returns:** 
```typescript
Promise<{
  success: true;
  sent: number;
  failed: number;
  results: Array<{
    to: string;
    messageId?: string;
    error?: string;
  }>;
}>
```

---

## Changelog

### v2.1.0 (2025-10-13)
- ✅ Added `shov.email.send()` method
- ✅ Added `shov.email.sendTemplate()` method
- ✅ Added `shov.email.sendBatch()` method
- ✅ Full TypeScript support with detailed types
- ✅ Complete parity with master API reference

---

## Support

For issues or questions:
- Documentation: https://shov.com/docs/email
- GitHub: https://github.com/shov/shov-js
- Discord: https://discord.gg/shov


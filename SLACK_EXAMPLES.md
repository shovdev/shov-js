# Slack API Examples - shov-js v2.8.0

## New in v2.8.0: Slack Operations

The Shov JS SDK now includes full Slack support with three methods:
- `shov.slack.send()` - Send messages to channels or webhooks
- `shov.slack.sendDirect()` - Send direct messages to users
- `shov.slack.sendWithActions()` - Send messages with interactive buttons

---

## Installation

```bash
npm install shov-js@latest
```

---

## Configuration

### Using Webhook URL

```typescript
import { Shov } from 'shov-js';

const shov = new Shov({
  projectName: 'my-project',
  apiKey: process.env.SHOV_API_KEY
});

// Send with webhook URL (no bot token needed)
await shov.slack.send({
  text: 'Hello from Shov!',
  webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
});
```

### Using Bot Token

Configure your Slack bot token via secrets:

```bash
shov secrets set SLACK_BOT_TOKEN xoxb-your-token
shov secrets set SLACK_SIGNING_SECRET your-signing-secret
```

Then send to channels:

```typescript
await shov.slack.send({
  text: 'Notification message',
  channel: '#general'  // Requires bot token
});
```

---

## Basic Message Sending

### Simple Text Message

```typescript
// Using webhook URL
await shov.slack.send({
  text: '🚀 Deployment successful!'
  webhookUrl: process.env.SLACK_WEBHOOK_URL
});

// Using bot token (channel required)
await shov.slack.send({
  text: 'New user registered!',
  channel: '#notifications'
});
```

### Custom Username and Icon

```typescript
await shov.slack.send({
  text: 'Automated report generated',
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  username: 'Report Bot',
  iconEmoji: ':bar_chart:'
});
```

### Thread Reply

```typescript
// Send parent message
const parent = await shov.slack.send({
  text: 'Starting deployment...',
  channel: '#deploys'
});

// Reply in thread
await shov.slack.send({
  text: '✅ Deployment complete!',
  channel: '#deploys',
  threadTs: parent.ts  // Reply to parent message
});
```

---

## Rich Messages with Blocks

Slack Block Kit allows rich formatting:

```typescript
await shov.slack.send({
  text: 'Server Alert',
  channel: '#monitoring',
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '⚠️ High CPU Usage Detected'
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Server load is above 85%'
      }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Server:*\nproduction-1' },
        { type: 'mrkdwn', text: '*CPU:*\n87%' },
        { type: 'mrkdwn', text: '*Memory:*\n65%' },
        { type: 'mrkdwn', text: '*Time:*\n' + new Date().toISOString() }
      ]
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Alert triggered at ' + new Date().toLocaleString()
        }
      ]
    }
  ]
});
```

---

## Direct Messages

### Send DM by User ID

```typescript
await shov.slack.sendDirect({
  user: 'U1234567890',  // Slack user ID
  text: 'Your report is ready to download!'
});
```

### Send DM by Email

```typescript
await shov.slack.sendDirect({
  user: 'john@company.com',  // User's email
  text: 'Welcome to the team! 👋'
});
```

### Rich DM with Blocks

```typescript
await shov.slack.sendDirect({
  user: 'jane@company.com',
  text: 'Weekly Report',
  blocks: [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📊 Your Weekly Report' }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Here are your stats for this week:'
      }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Total Sales:*\n$12,450' },
        { type: 'mrkdwn', text: '*New Customers:*\n23' },
        { type: 'mrkdwn', text: '*Conversion Rate:*\n4.2%' }
      ]
    }
  ]
});
```

---

## Interactive Messages with Actions

### Approval Workflow

```typescript
await shov.slack.sendWithActions({
  text: 'New expense report submitted by John Doe ($234.50)',
  channel: '#approvals',
  actions: [
    {
      text: 'Approve',
      id: 'approve_expense',
      value: 'expense_12345',
      style: 'primary'
    },
    {
      text: 'Reject',
      id: 'reject_expense',
      value: 'expense_12345',
      style: 'danger'
    },
    {
      text: 'View Details',
      id: 'view_expense',
      url: 'https://app.example.com/expenses/12345'
    }
  ]
});
```

### Deployment Confirmation

```typescript
await shov.slack.sendWithActions({
  text: '🚀 Ready to deploy v2.1.0 to production?',
  channel: '#deploys',
  actions: [
    {
      text: 'Deploy Now',
      id: 'deploy',
      value: 'v2.1.0',
      style: 'primary'
    },
    {
      text: 'Cancel',
      id: 'cancel',
      value: 'deploy_cancel'
    }
  ]
});
```

### Survey or Feedback

```typescript
await shov.slack.sendWithActions({
  text: 'How was your experience with the new feature?',
  channel: '#feedback',
  actions: [
    { text: '😍 Great', id: 'feedback', value: '5' },
    { text: '😊 Good', id: 'feedback', value: '4' },
    { text: '😐 Okay', id: 'feedback', value: '3' },
    { text: '😞 Poor', id: 'feedback', value: '2' }
  ]
});
```

---

## Real-World Use Cases

### 1. Error Notifications

```typescript
async function notifyError(error: Error, context: any) {
  await shov.slack.send({
    text: 'Application Error',
    channel: '#errors',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🚨 Application Error' }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Error:*\n${error.message}` },
          { type: 'mrkdwn', text: `*User:*\n${context.userId}` },
          { type: 'mrkdwn', text: `*Endpoint:*\n${context.endpoint}` },
          { type: 'mrkdwn', text: `*Time:*\n${new Date().toISOString()}` }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '```\n' + error.stack + '\n```'
        }
      }
    ]
  });

  // Track in analytics
  await shov.events.track('error.slack_notification', {
    error: error.message,
    userId: context.userId
  });
}
```

### 2. New User Welcome

```typescript
async function welcomeNewUser(user: { name: string; email: string; id: string }) {
  // Send DM to user
  await shov.slack.sendDirect({
    user: user.email,
    text: `Welcome ${user.name}!`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `Welcome, ${user.name}! 👋` }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Thanks for joining! Here are some resources to get started:'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• <https://docs.company.com|Documentation>\n• <https://help.company.com|Help Center>\n• <https://community.company.com|Community Forum>'
        }
      }
    ]
  });

  // Notify team
  await shov.slack.send({
    text: `New user: ${user.name}`,
    channel: '#team',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🎉 *New user signed up!*\n*Name:* ${user.name}\n*Email:* ${user.email}`
        }
      }
    ]
  });
}
```

### 3. Daily Metrics Report

```typescript
async function sendDailyReport() {
  // Get metrics from database
  const metrics = await getMetrics();
  
  await shov.slack.send({
    text: 'Daily Metrics Report',
    channel: '#metrics',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📊 Daily Metrics - ' + new Date().toLocaleDateString() }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*New Users:*\n${metrics.newUsers}` },
          { type: 'mrkdwn', text: `*Active Users:*\n${metrics.activeUsers}` },
          { type: 'mrkdwn', text: `*Revenue:*\n$${metrics.revenue.toLocaleString()}` },
          { type: 'mrkdwn', text: `*Conversions:*\n${metrics.conversions}` }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Performing:*\n${metrics.topProducts.map(p => `• ${p.name} (${p.sales} sales)`).join('\n')}`
        }
      }
    ]
  });
}

// Schedule with cron
// 0 9 * * * - Every day at 9am
```

### 4. Deployment Pipeline

```typescript
async function deploymentPipeline(version: string) {
  // Start notification
  const message = await shov.slack.send({
    text: `Deployment started: ${version}`,
    channel: '#deploys',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚀 *Starting deployment*\nVersion: ${version}\nStatus: Running...`
        }
      }
    ]
  });

  try {
    // Run deployment
    await runDeployment(version);
    
    // Success notification (in thread)
    await shov.slack.send({
      text: 'Deployment successful!',
      channel: '#deploys',
      threadTs: message.ts,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Deployment successful!*\nVersion ${version} is now live.`
          }
        }
      ]
    });
  } catch (error) {
    // Failure notification (in thread)
    await shov.slack.send({
      text: 'Deployment failed!',
      channel: '#deploys',
      threadTs: message.ts,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❌ *Deployment failed!*\nError: ${error.message}`
          }
        }
      ]
    });
    
    // Mention on-call engineer
    await shov.slack.send({
      text: '<@U123456> Deployment failed, please investigate',
      channel: '#deploys'
    });
  }
}
```

### 5. Support Ticket System

```typescript
async function createSupportTicket(ticket: {
  id: string;
  title: string;
  description: string;
  priority: string;
  customer: string;
}) {
  await shov.slack.sendWithActions({
    text: `New support ticket: ${ticket.title}`,
    channel: '#support',
    actions: [
      {
        text: 'Claim Ticket',
        id: 'claim',
        value: ticket.id,
        style: 'primary'
      },
      {
        text: 'View Details',
        id: 'view',
        url: `https://support.company.com/tickets/${ticket.id}`
      },
      {
        text: 'Contact Customer',
        id: 'contact',
        value: ticket.customer
      }
    ]
  });

  // Store ticket
  await shov.add('support_tickets', {
    ...ticket,
    status: 'open',
    createdAt: new Date().toISOString()
  });
}
```

### 6. Scheduled Reminders

```typescript
async function sendReminders() {
  const reminders = await shov.where('reminders', {
    filter: {
      scheduledFor: { $lte: new Date().toISOString() },
      sent: false
    }
  });

  for (const reminder of reminders.items) {
    await shov.slack.sendDirect({
      user: reminder.value.userId,
      text: reminder.value.message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⏰ *Reminder*\n${reminder.value.message}`
          }
        }
      ]
    });

    // Mark as sent
    await shov.update('reminders', reminder.id, {
      ...reminder.value,
      sent: true,
      sentAt: new Date().toISOString()
    });
  }
}
```

---

## Error Handling

### Handling Send Failures

```typescript
try {
  await shov.slack.send({
    text: 'Test message',
    channel: '#general'
  });
} catch (error) {
  if (error.status === 403) {
    console.error('Bot not authorized for channel');
  } else if (error.status === 404) {
    console.error('Channel not found');
  } else {
    console.error('Slack error:', error.message);
  }
}
```

### Retry Logic

```typescript
async function sendWithRetry(options: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await shov.slack.send(options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

## Best Practices

### 1. **Use Threads for Related Messages**

```typescript
const parent = await shov.slack.send({
  text: 'Processing batch job...',
  channel: '#jobs'
});

// Keep updates in thread
for (const step of steps) {
  await shov.slack.send({
    text: `Step ${step.id}: ${step.status}`,
    channel: '#jobs',
    threadTs: parent.ts
  });
}
```

### 2. **Rate Limiting**

```typescript
// Don't spam - batch similar messages
const errors = getRecentErrors();
if (errors.length > 0) {
  await shov.slack.send({
    text: `${errors.length} errors in last 5 minutes`,
    channel: '#errors',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: errors.map(e => `• ${e.message}`).join('\n')
        }
      }
    ]
  });
}
```

### 3. **Fallback Text**

Always include plain text as fallback:

```typescript
await shov.slack.send({
  text: 'Deployment Status',  // Fallback for notifications
  channel: '#deploys',
  blocks: [/* Rich blocks */]
});
```

### 4. **Store Message References**

```typescript
const message = await shov.slack.send({ ... });

await shov.add('slack_messages', {
  ts: message.ts,
  channel: message.channel,
  type: 'deployment',
  relatedId: deploymentId
});
```

---

## Configuration

### Webhook URL Setup

1. Go to your Slack App settings
2. Enable Incoming Webhooks
3. Add webhook URL to your project:

```bash
shov secrets set SLACK_WEBHOOK_URL https://hooks.slack.com/services/...
```

### Bot Token Setup

1. Create Slack App at api.slack.com/apps
2. Add Bot Token Scopes: `chat:write`, `users:read`, `users:read.email`
3. Install app to workspace
4. Configure secrets:

```bash
shov secrets set SLACK_BOT_TOKEN xoxb-...
shov secrets set SLACK_SIGNING_SECRET ...
```

---

## API Reference

### `shov.slack.send(options)`

Send a message to a Slack channel or webhook.

**Parameters:**
- `text`: `string` - Message text (required)
- `channel?`: `string` - Channel ID or name (requires bot token)
- `webhookUrl?`: `string` - Webhook URL (alternative to channel)
- `blocks?`: `any[]` - Slack Block Kit blocks
- `threadTs?`: `string` - Thread timestamp for replies
- `username?`: `string` - Custom username (webhook only)
- `iconEmoji?`: `string` - Custom icon emoji (webhook only)

**Returns:** `Promise<{ success: true; ts: string; channel: string }>`

---

### `shov.slack.sendDirect(options)`

Send a direct message to a user.

**Parameters:**
- `user`: `string` - User ID or email (required)
- `text`: `string` - Message text (required)
- `blocks?`: `any[]` - Slack Block Kit blocks

**Returns:** `Promise<{ success: true; ts: string; channel: string }>`

---

### `shov.slack.sendWithActions(options)`

Send a message with interactive buttons.

**Parameters:**
- `text`: `string` - Message text (required)
- `channel?`: `string` - Channel ID or name
- `webhookUrl?`: `string` - Webhook URL
- `actions`: `Array` - Button actions (required)
  - `text`: `string` - Button text
  - `id`: `string` - Action identifier
  - `value?`: `string` - Value passed to action
  - `url?`: `string` - Link URL
  - `style?`: `'primary' | 'danger'` - Button style

**Returns:** `Promise<{ success: true; ts: string; channel: string }>`

---

## Changelog

### v2.8.0 (2025-10-13)
- ✅ Added `shov.slack.send()` method
- ✅ Added `shov.slack.sendDirect()` method
- ✅ Added `shov.slack.sendWithActions()` method
- ✅ Full TypeScript support
- ✅ Complete parity with master API reference

---

## Support

For issues or questions:
- Documentation: https://shov.com/docs/slack
- GitHub: https://github.com/shov/shov-js
- Discord: https://discord.gg/shov

